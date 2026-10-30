// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

function saveAccess() {
	const source = readFileSync('src/lib/components/layout/Sidebar/ChannelModal.svelte', 'utf8');
	const walk = (value: unknown): Record<string, unknown>[] => {
		if (!value || typeof value !== 'object') return [];
		if (Array.isArray(value)) return value.flatMap(walk);
		const node = value as Record<string, unknown>;
		return [node, ...Object.values(node).flatMap(walk)];
	};
	const control = walk(parse(source).html).find(
		(node) => node.type === 'InlineComponent' && node.name === 'AccessControl'
	);
	const attribute = (
		control?.attributes as {
			name: string;
			value: { expression: { start: number; end: number } }[];
		}[]
	).find((item) => item.name === 'onChange');
	if (!attribute) throw new Error('Access change handler missing');
	const expression = attribute.value[0].expression;
	const previous = [
		{ id: 'existing-grant', principal_type: 'user', principal_id: 'owner', permission: 'read' }
	];
	const normalized = [
		{ id: 'normalized-grant', principal_type: 'group', principal_id: 'team', permission: 'read' }
	];
	const context = {
		edit: true,
		channel: { id: 'channel', access_grants: previous },
		accessGrants: previous,
		loading: false,
		structuredClone,
		localStorage: { token: 'fixture' },
		$i18n: { t: (text: string) => text },
		toast: { error: vi.fn(), success: vi.fn() },
		onUpdate: vi.fn(),
		updateChannelAccessGrants: vi.fn(async () => ({ id: 'channel', access_grants: normalized }))
	};
	const run = runInNewContext(
		ts.transpileModule(`(${source.slice(expression.start, expression.end)})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as (grants: object[]) => Promise<void>;
	return { run, context, previous, normalized };
}

it('publishes normalized server grants after saving channel access', async () => {
	const { run, context, normalized } = saveAccess();
	const input = [{ principal_type: 'group', principal_id: 'team', permission: 'read' }];
	await run(input);
	expect(context.updateChannelAccessGrants).toHaveBeenCalledWith('fixture', 'channel', input);
	expect(context.channel.access_grants).toEqual(normalized);
	expect(context.accessGrants).toEqual(normalized);
	expect(context.channel.access_grants).not.toBe(normalized);
	expect(context.toast.success).toHaveBeenCalledOnce();
	expect(context.onUpdate).toHaveBeenCalledOnce();
	expect(context.loading).toBe(false);
});

it('retains confirmed access and reports a refused save without success', async () => {
	const { run, context, previous } = saveAccess();
	context.updateChannelAccessGrants.mockRejectedValueOnce(new Error('Refused'));
	await run([]);
	expect(context.channel.access_grants).toEqual(previous);
	expect(context.accessGrants).toEqual(previous);
	expect(context.toast.error).toHaveBeenCalledOnce();
	expect(context.toast.success).not.toHaveBeenCalled();
	expect(context.onUpdate).not.toHaveBeenCalled();
	expect(context.loading).toBe(false);
});
