import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test, type Account } from './onboarding-paths.fixture';

async function openResponse(
	page: Page,
	request: APIRequestContext,
	account: Account,
	content: string
): Promise<void> {
	const question = randomUUID();
	const answer = randomUUID();
	const messages = [
		{
			id: question,
			role: 'user',
			content: 'Media check',
			parentId: null,
			childrenIds: [answer],
			timestamp: 1
		},
		{
			id: answer,
			role: 'assistant',
			model: 'gpt-5.6-luna',
			content,
			parentId: question,
			childrenIds: [],
			done: true,
			timestamp: 2
		}
	];
	const created = await request.post('/api/v1/chats/new', {
		headers: { Authorization: `Bearer ${account.token}` },
		data: {
			chat: {
				title: 'Media fixture',
				models: ['gpt-5.6-luna'],
				messages,
				history: {
					currentId: answer,
					messages: Object.fromEntries(messages.map((message) => [message.id, message]))
				},
				params: {},
				timestamp: 1
			}
		}
	});
	expect(created.ok()).toBe(true);
	await page.addInitScript(({ token }) => localStorage.setItem('token', token), account);
	await page.goto(`/c/${(await created.json()).id}`);
}

test('file token and audio src create native players after reload', async ({
	page,
	request,
	account
}) => {
	await page.route('**/api/v1/files/ab-12/content', (route) =>
		route.fulfill({
			contentType: 'video/webm',
			body: readFileSync('e2e/fixtures/markdown-media.webm')
		})
	);
	await openResponse(
		page,
		request,
		account,
		'`{{VIDEO_FILE_ID_ab-12}}`\n\n{{VIDEO_FILE_ID_ab-12}}\n\n<audio src="/audio/notification.mp3" controls></audio>'
	);
	for (const reload of [false, true]) {
		if (reload) await page.reload();
		const log = page.getByRole('log');
		await expect(log.locator('video')).toHaveAttribute('src', '/api/v1/files/ab-12/content');
		await expect(log.locator('audio')).toHaveAttribute('src', '/audio/notification.mp3');
		await expect(log.getByText('{{VIDEO_FILE_ID_ab-12}}', { exact: true })).toBeVisible();
		for (const kind of ['video', 'audio']) {
			const player = log.locator(kind);
			await expect
				.poll(() => player.evaluate((node: HTMLMediaElement) => node.readyState))
				.toBeGreaterThanOrEqual(1);
			await player.evaluate((node: HTMLMediaElement) => {
				node.muted = true;
				return node.play();
			});
			await expect
				.poll(() => player.evaluate((node: HTMLMediaElement) => node.currentTime))
				.toBeGreaterThan(0);
			await player.evaluate((node: HTMLMediaElement) => node.pause());
		}
	}
});

test('legacy block sources remain playable', async ({ page, request, account }) => {
	await page.route('**/api/v1/files/ab-12/content', (route) =>
		route.fulfill({
			contentType: 'video/webm',
			body: readFileSync('e2e/fixtures/markdown-media.webm')
		})
	);
	await openResponse(
		page,
		request,
		account,
		'<video>\n/api/v1/files/ab-12/content\n</video>\n\n<audio>\n/audio/notification.mp3\n</audio>'
	);
	for (const [kind, src] of [
		['video', '/api/v1/files/ab-12/content'],
		['audio', '/audio/notification.mp3']
	]) {
		const player = page.getByRole('log').locator(kind);
		await expect(player).toHaveAttribute('src', src);
		await expect
			.poll(() => player.evaluate((node: HTMLMediaElement) => node.readyState))
			.toBeGreaterThanOrEqual(1);
	}
});

test('unsafe attributes and legacy source text do not create players', async ({
	page,
	request,
	account
}) => {
	const content = '<video src="javascript:alert(1)"></video>\n\n<audio>javascript:alert(1)</audio>';
	await openResponse(page, request, account, content);
	const log = page.getByRole('log');
	await expect(log).toContainText('<video src="javascript:alert(1)">');
	await expect(log.locator('video, audio')).toHaveCount(0);
});

test('inline src works without displaying media closing tags', async ({
	page,
	request,
	account
}) => {
	await openResponse(
		page,
		request,
		account,
		'Before <video src="/airis/guide/first-task-20261002.mp4"></video> after.'
	);
	const log = page.getByRole('log');
	await expect(log.locator('video')).toHaveAttribute('src', '/airis/guide/first-task-20261002.mp4');
	await expect(log).not.toContainText('</video>');
	await expect(log).toContainText('after.');
});
