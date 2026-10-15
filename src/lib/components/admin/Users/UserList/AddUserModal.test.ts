// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { getErrorMessage } from '$lib/utils/airis/error_message';

const csv = (count = 1): string =>
	'Name,Email,Password,Role\n' +
	Array.from(
		{ length: count },
		(_, i) => `User ${i},user${i}@example.test,fixture-secret,user`
	).join('\n');
const file = (text = csv()): File => {
	const selected = new File([text], 'users.csv', { type: 'text/csv' });
	selected.text = vi.fn(async () => text);
	return selected;
};
const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
const rig = (files: File[] | null = [file()], tab = 'import') => {
	const source = readFileSync(
		'src/lib/components/admin/Users/UserList/AddUserModal.svelte',
		'utf8'
	);
	const script = parse(source).instance;
	if (!script) throw new Error('Missing component script');
	const parsed = ts.createSourceFile(
		'add-user.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const reactive = parsed.statements
		.filter(ts.isLabeledStatement)
		.map((node) => node.getText(parsed).replace(/^\$:/, ''))
		.join('\n');
	const code = parsed.statements
		.filter((node) => !ts.isImportDeclaration(node) && !ts.isLabeledStatement(node))
		.map((node) => node.getText(parsed).replace(/^export /, ''))
		.join('\n');
	const add = vi.fn<[string, string, string, string, string, string], Promise<{ id: string }>>(
			async () => ({ id: 'created' })
		),
		save = vi.fn(),
		error = vi.fn(),
		success = vi.fn();
	const log = { debug: vi.fn(), log: vi.fn(), error: vi.fn() };
	const jobs: Promise<unknown>[] = [],
		destroy: (() => void)[] = [];
	const input = { value: 'users.csv' },
		storage = { token: 'fixture-token' };
	class Reader {
		onload: ((event: { target: { result: string } }) => Promise<void>) | null = null;
		onerror: (() => void) | null = null;
		readAsText(selected: File): void {
			if (!selected) throw new Error('Missing file');
			jobs.push(
				selected.text().then(
					(result) => this.onload?.({ target: { result } }),
					() => this.onerror?.()
				)
			);
		}
	}
	const actual = runInNewContext(
		ts.transpileModule(
			code +
				`\nshow = true; tab = selectedTab; inputFiles = selectedFiles; ({ submit: submitHandler, state: () => ({ loading, show, inputFiles, user: _user }), close: () => { show = false; ${reactive} }, reopen: () => { show = true; ${reactive} }, draft: (value) => { _user = value; } });`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{
			selectedTab: tab,
			selectedFiles: files,
			addUser: add,
			createEventDispatcher: () => save,
			getContext: () => ({}),
			onDestroy: (callback: () => void) => destroy.push(callback),
			$i18n: {
				t: (key: string, params?: { userCount?: number }) =>
					params?.userCount === undefined ? key : `${params.userCount} users imported`
			},
			toast: { error, success },
			localStorage: storage,
			document: { getElementById: () => input },
			generateInitialsImage: (name: string) => `image:${name}`,
			getErrorMessage,
			FileReader: Reader,
			console: log
		}
	) as {
		submit: () => Promise<void>;
		state: () => {
			loading: boolean;
			show: boolean;
			inputFiles: File[] | null;
			user: { name: string; email: string; password: string; role: string };
		};
		close: () => void;
		reopen: () => void;
		draft: (user: { name: string; email: string; password: string; role: string }) => void;
	};
	return {
		actual,
		add,
		save,
		error,
		success,
		log,
		jobs,
		input,
		storage,
		destroy: () => destroy.forEach((fn) => fn()),
		finish: async () => {
			await Promise.all(jobs);
		}
	};
};

it('stays busy during reading and ignores a duplicate submission', async () => {
	const selected = file(),
		read = deferred<string>();
	selected.text = vi.fn(() => read.promise);
	const r = rig([selected]);
	const first = r.actual.submit(),
		duplicate = r.actual.submit();
	expect(r.actual.state().loading).toBe(true);
	read.resolve(csv());
	await first;
	await duplicate;
	await r.finish();
	expect(selected.text).toHaveBeenCalledOnce();
	expect(r.add).toHaveBeenCalledOnce();
	expect(r.save).toHaveBeenCalledOnce();
});
it('preserves ten-user batches and stays busy until every confirmed response', async () => {
	const r = rig([file(csv(21))]),
		first = deferred<{ id: string }>();
	r.add.mockImplementationOnce(() => first.promise);
	const action = r.actual.submit();
	await vi.waitFor(() => expect(r.add).toHaveBeenCalledTimes(10));
	expect(r.actual.state().loading).toBe(true);
	first.resolve({ id: 'first' });
	await action;
	await r.finish();
	expect(r.add).toHaveBeenCalledTimes(21);
	expect(r.success).toHaveBeenCalledWith('21 users imported');
	expect(r.save).toHaveBeenCalledOnce();
	expect(r.actual.state().loading).toBe(false);
});
it('does not log CSV credentials', async () => {
	const r = rig();
	await r.actual.submit();
	await r.finish();
	expect(r.log.debug).not.toHaveBeenCalled();
	expect(r.log.log).not.toHaveBeenCalled();
	expect(r.add).toHaveBeenCalledWith(
		'fixture-token',
		'User 0',
		'user0@example.test',
		'fixture-secret',
		'user',
		'image:User 0'
	);
});
it.each([null, []])('handles missing or canceled file selection', async (files) => {
	const r = rig(files);
	await expect(r.actual.submit()).resolves.toBeUndefined();
	await r.finish();
	expect(r.add).not.toHaveBeenCalled();
	expect(r.error).toHaveBeenCalledWith('File not found.');
	expect(r.actual.state().loading).toBe(false);
});
it('reports a read failure and permits retry without losing the selected file', async () => {
	const selected = file();
	selected.text = vi.fn().mockRejectedValueOnce(new Error('Unreadable')).mockResolvedValue(csv());
	const r = rig([selected]);
	await r.actual.submit();
	await r.finish();
	expect(r.error).toHaveBeenCalledWith('Failed to upload file.');
	expect(r.add).not.toHaveBeenCalled();
	expect(r.actual.state().loading).toBe(false);
	await r.actual.submit();
	await r.finish();
	expect(r.add).toHaveBeenCalledOnce();
});
it.each(['close', 'reopen', 'destroy'])(
	'does not start requests after %s during reading',
	async (mode) => {
		const selected = file(),
			read = deferred<string>();
		selected.text = vi.fn(() => read.promise);
		const r = rig([selected]),
			action = r.actual.submit();
		if (mode === 'destroy') r.destroy();
		else {
			r.actual.close();
			if (mode === 'reopen') r.actual.reopen();
		}
		read.resolve(csv());
		await action;
		await r.finish();
		expect(r.add).not.toHaveBeenCalled();
		expect(r.save).not.toHaveBeenCalled();
		expect(r.success).not.toHaveBeenCalled();
	}
);
it('stops unscheduled batches after closing without pretending to undo in-flight users', async () => {
	const r = rig([file(csv(21))]),
		response = deferred<{ id: string }>();
	r.add.mockImplementation(() => response.promise);
	const action = r.actual.submit();
	await vi.waitFor(() => expect(r.add).toHaveBeenCalledTimes(10));
	r.actual.close();
	response.resolve({ id: 'created' });
	await action;
	await r.finish();
	expect(r.add).toHaveBeenCalledTimes(10);
	expect(r.save).not.toHaveBeenCalled();
	expect(r.success).not.toHaveBeenCalled();
});
it('uses the original token after asynchronous reading', async () => {
	const selected = file(),
		read = deferred<string>();
	selected.text = vi.fn(() => read.promise);
	const r = rig([selected]),
		action = r.actual.submit();
	r.storage.token = 'different-session';
	read.resolve(csv());
	await action;
	await r.finish();
	expect(r.add.mock.calls[0][0]).toBe('fixture-token');
});
it('preserves valid rows and reports partial failures, skipping an empty final line', async () => {
	const r = rig([file(csv(3) + '\n')]);
	r.add.mockRejectedValueOnce('Duplicate email');
	await r.actual.submit();
	await r.finish();
	expect(r.add).toHaveBeenCalledTimes(3);
	expect(r.success).toHaveBeenCalledWith('2 users imported');
	expect(r.error).toHaveBeenCalledTimes(1);
	expect(r.error).toHaveBeenCalledWith('Row 2: Duplicate email');
	expect(r.save).toHaveBeenCalledOnce();
});
it('keeps role normalization and rejects a malformed row without sending it', async () => {
	const r = rig([
		file(
			'Name,Email,Password,Role\n Alice , alice@example.test , fixture-secret , ADMIN\nBad,row\n'
		)
	]);
	await r.actual.submit();
	await r.finish();
	expect(r.add).toHaveBeenCalledOnce();
	expect(r.add.mock.calls[0].slice(1, 5)).toEqual([
		'Alice',
		'alice@example.test',
		'fixture-secret',
		'admin'
	]);
	expect(r.error).toHaveBeenCalledTimes(1);
	expect(r.error).toHaveBeenCalledWith('Row 3: invalid format.');
});
it('does not clear a reopened manual draft or dispatch save from an old response', async () => {
	const r = rig(null, ''),
		response = deferred<{ id: string }>();
	r.add.mockImplementationOnce(() => response.promise);
	r.actual.draft({
		name: 'Old',
		email: 'old@example.test',
		password: 'fixture-secret',
		role: 'user'
	});
	const action = r.actual.submit();
	r.actual.close();
	r.actual.reopen();
	const draft = {
		name: 'New',
		email: 'new@example.test',
		password: 'new-fixture',
		role: 'pending'
	};
	r.actual.draft(draft);
	response.resolve({ id: 'created' });
	await action;
	await r.finish();
	expect(r.actual.state().show).toBe(true);
	expect(r.actual.state().user).toEqual(draft);
	expect(r.save).not.toHaveBeenCalled();
});
it('allows manual creation to retry after a rejected response', async () => {
	const r = rig(null, '');
	r.add.mockRejectedValueOnce('Rejected');
	r.actual.draft({
		name: 'User',
		email: 'user@example.test',
		password: 'fixture-secret',
		role: 'user'
	});
	await r.actual.submit();
	expect(r.error).toHaveBeenCalledWith('Rejected');
	expect(r.actual.state().loading).toBe(false);
	expect(r.actual.state().show).toBe(true);
	await r.actual.submit();
	expect(r.add).toHaveBeenCalledTimes(2);
	expect(r.save).toHaveBeenCalledOnce();
	expect(r.actual.state().show).toBe(false);
});
