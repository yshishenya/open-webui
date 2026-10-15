// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { join } from 'node:path';
import { parse } from 'svelte/compiler';
import { writable } from 'svelte/store';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const script = (path: string): ts.SourceFile => {
	const source = readFileSync(join(process.env.AIRIS_TEST_ARTIFACT_ROOT ?? '.', path), 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing component script');
	return ts.createSourceFile(
		'preview.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
};

const rig = (code: string | null = null) => {
	const parsed = script('src/lib/components/chat/Artifacts.svelte');
	const artifactCode = writable<string | null>(code);
	const artifactContents = writable<{ type: string; content: string }[]>([
		{ type: 'iframe', content: '<p>first</p>' },
		{ type: 'svg', content: '<svg>second</svg>' },
		{ type: 'iframe', content: '<p>third</p>' }
	]);
	let mounted: () => () => void = () => {
		throw new Error('Missing mount');
	};
	const context = {
		artifactCode,
		artifactContents,
		showControls: { set: vi.fn() },
		showArtifacts: { set: vi.fn() },
		getContext: () => ({ t: (value: string) => value }),
		createEventDispatcher: () => vi.fn(),
		onMount: (callback: typeof mounted): void => {
			mounted = callback;
		},
		window,
		document,
		URL,
		Blob,
		console: { log: vi.fn(), info: vi.fn(), error: vi.fn() },
		toast: { error: vi.fn() },
		$i18n: { t: (value: string): string => value },
		$chatId: 'fixture'
	};
	const codeText = parsed.statements
		.filter((statement) => !ts.isImportDeclaration(statement))
		.map((statement) => statement.getText(parsed).replace(/^export /, ''))
		.join('\n');
	const api = runInNewContext(
		ts.transpileModule(
			`${codeText}\n({iframeLoadHandler,showFullScreen,navigateContent,selection:()=>selectedContentIdx,setFrame:value=>iframeElement=value})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		iframeLoadHandler: () => void;
		showFullScreen: () => void | Promise<void>;
		navigateContent: (direction: 'prev' | 'next') => void;
		selection: () => number;
		setFrame: (frame: HTMLIFrameElement) => void;
	};
	return { ...context, api, mount: () => mounted() };
};

it('ignores detached and origin-isolated frames without trying to read their events', () => {
	const r = rig();
	const frame = document.createElement('iframe');
	r.api.setFrame(frame);
	expect(() => r.api.iframeLoadHandler()).not.toThrow();
	const denied = vi.fn(() => {
		throw new DOMException('Blocked frame access', 'SecurityError');
	});
	Object.defineProperty(frame, 'contentWindow', { value: { addEventListener: denied } });
	Object.defineProperty(frame, 'contentDocument', { value: null });
	expect(() => r.api.iframeLoadHandler()).not.toThrow();
	expect(denied).not.toHaveBeenCalled();
});

it('ignores non-element targets and preserves internal-link interception and external blocking', () => {
	const r = rig();
	const frame = document.createElement('iframe');
	document.body.append(frame);
	try {
		r.api.setFrame(frame);
		const doc = frame.contentDocument;
		const view = frame.contentWindow;
		if (!doc || !view) throw new Error('Missing fixture frame');
		const listen = vi.spyOn(view, 'addEventListener');
		r.api.iframeLoadHandler();
		const click = listen.mock.calls.find(([name]) => name === 'click')?.[1];
		if (typeof click !== 'function') throw new Error('Missing click handler');
		expect(() => click.call(view, new Event('click'))).not.toThrow();
		const push = vi.spyOn(view.history, 'pushState').mockImplementation(() => {});
		for (const [href, internal] of [
			[`${window.location.origin}/preview#section`, true],
			['https://other.test/private', false]
		] as const) {
			const link = doc.createElement('a');
			link.href = href;
			doc.body.append(link);
			const event = doc.createEvent('MouseEvents');
			event.initMouseEvent(
				'click',
				true,
				true,
				view,
				0,
				0,
				0,
				0,
				0,
				false,
				false,
				false,
				false,
				0,
				null
			);
			link.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
			expect(push).toHaveBeenCalledTimes(1);
			if (internal) expect(push).toHaveBeenCalledWith(null, '', '/preview#section');
		}
	} finally {
		frame.remove();
	}
});

it('registers one drag blocker rather than adding one on every hover', () => {
	const r = rig();
	const frame = document.createElement('iframe');
	document.body.append(frame);
	try {
		const view = frame.contentWindow;
		if (!view) throw new Error('Missing fixture frame');
		r.api.setFrame(frame);
		const listen = vi.spyOn(view, 'addEventListener');
		r.api.iframeLoadHandler();
		view.dispatchEvent(new Event('mouseenter'));
		view.dispatchEvent(new Event('mouseenter'));
		expect(listen.mock.calls.filter(([name]) => name === 'dragstart')).toHaveLength(1);
		const drag = new Event('dragstart', { cancelable: true });
		view.dispatchEvent(drag);
		expect(drag.defaultPrevented).toBe(true);
	} finally {
		frame.remove();
	}
});

it('opens the requested version on first mount and keeps navigation within available versions', () => {
	const r = rig('<p>first</p>');
	const dispose = r.mount();
	expect(r.api.selection()).toBe(0);
	r.api.navigateContent('next');
	expect(r.api.selection()).toBe(1);
	r.api.navigateContent('prev');
	r.api.navigateContent('prev');
	expect(r.api.selection()).toBe(0);
	r.artifactCode.set('<svg>second</svg>');
	expect(r.api.selection()).toBe(1);
	dispose();
	r.artifactCode.set('<p>third</p>');
	expect(r.api.selection()).toBe(1);
});

it('clamps selection when history shrinks and closes empty content', () => {
	const r = rig();
	const dispose = r.mount();
	expect(r.api.selection()).toBe(2);
	r.artifactContents.set([{ type: 'iframe', content: 'remaining' }]);
	expect(r.api.selection()).toBe(0);
	r.artifactContents.set([]);
	expect(r.api.selection()).toBe(0);
	expect(r.showArtifacts.set).toHaveBeenCalledWith(false);
	expect(r.showControls.set).toHaveBeenCalledWith(false);
	dispose();
});

it.each(['requestFullscreen', 'webkitRequestFullscreen', 'msRequestFullscreen'])(
	'preserves the %s receiver and contains fullscreen refusal',
	async (method) => {
		const r = rig();
		const frame = document.createElement('iframe');
		const invoke = vi.fn(function (this: HTMLIFrameElement): void {
			expect(this).toBe(frame);
		});
		Object.defineProperty(frame, method, { value: invoke, configurable: true });
		r.api.setFrame(frame);
		await r.api.showFullScreen();
		expect(invoke).toHaveBeenCalledTimes(1);
		invoke.mockImplementation(() => {
			throw new Error('Fullscreen refused');
		});
		await expect(Promise.resolve().then(() => r.api.showFullScreen())).resolves.toBeUndefined();
		expect(r.toast.error).toHaveBeenCalledTimes(1);
		invoke.mockImplementation(() => Promise.reject(new Error('Async fullscreen refusal')));
		await expect(Promise.resolve().then(() => r.api.showFullScreen())).resolves.toBeUndefined();
		expect(r.toast.error).toHaveBeenCalledTimes(2);
	}
);

it('does not put artifact code into preview or subscription logs', async () => {
	const r = rig();
	const dispose = r.mount();
	r.artifactContents.set([{ type: 'iframe', content: 'Private artifact words' }]);
	const parsed = script('src/lib/components/chat/Messages/ContentRenderer.svelte');
	const preview = parsed.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => [...statement.declarationList.declarations])
		.find((declaration) => declaration.name.getText(parsed) === 'previewHandler');
	if (!preview) throw new Error('Missing preview handler');
	const invoke = runInNewContext(
		ts.transpileModule(`const ${preview.getText(parsed)}; previewHandler;`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		{ ...r, showEmbeds: { set: vi.fn() } }
	) as (value: string) => Promise<void>;
	await invoke('Private artifact words');
	expect(JSON.stringify(r.console.log.mock.calls)).not.toContain('Private artifact words');
	dispose();
});

it('keeps fragment navigation inside srcdoc and contains refused path history', () => {
	const r = rig();
	const frame = document.createElement('iframe');
	document.body.append(frame);
	try {
		r.api.setFrame(frame);
		const doc = frame.contentDocument;
		const view = frame.contentWindow;
		if (!doc || !view) throw new Error('Missing fixture frame');
		const push = vi.spyOn(view.history, 'pushState').mockImplementation(() => {});
		r.api.iframeLoadHandler();
		const link = doc.createElement('a');
		link.href = '#section';
		doc.body.append(link);
		const click = (): void => {
			const event = doc.createEvent('MouseEvents');
			event.initMouseEvent(
				'click',
				true,
				true,
				view,
				0,
				0,
				0,
				0,
				0,
				false,
				false,
				false,
				false,
				0,
				null
			);
			link.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
		};
		click();
		expect(view.location.hash).toBe('#section');
		expect(push).not.toHaveBeenCalled();
		push.mockImplementation(() => {
			throw new DOMException('Srcdoc cannot rewrite its URL', 'SecurityError');
		});
		link.href = '/refused';
		click();
		expect(r.toast.error).toHaveBeenCalledTimes(1);
		link.href = 'http://[';
		click();
		expect(r.toast.error).toHaveBeenCalledTimes(2);
	} finally {
		frame.remove();
	}
});
