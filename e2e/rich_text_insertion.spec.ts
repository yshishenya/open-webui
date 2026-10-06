import { expect, test } from '@playwright/test';

test('compiled plain input preserves pasted ranges and multiline prompt commands', async ({
	page,
	request,
	baseURL
}) => {
	if (!baseURL || new URL(baseURL).hostname !== 'onboarding-paths')
		throw new Error('Requires disposable onboarding-paths fixture');
	const login = await request.post('/api/v1/auths/signin', {
		data: { email: 'fullpaths-admin@airis.you', password: 'local-fixture-only' }
	});
	expect(login.ok()).toBe(true);
	const admin = (await login.json()) as { token: string; role: string };
	expect(admin.role).toBe('admin');
	const headers = { Authorization: `Bearer ${admin.token}` };
	const settings = await request.get('/api/v1/users/user/settings', { headers });
	const original = await settings.json();
	const prepared = await request.post('/api/v1/users/user/settings/update', {
		headers,
		data: {
			...original,
			ui: {
				...original?.ui,
				showChangelog: false,
				richTextInput: false,
				insertPromptAsRichText: false
			}
		}
	});
	expect(prepared.ok()).toBe(true);
	const command = `insert-${Date.now()}`;
	const created = await request.post('/api/v1/prompts/create', {
		headers,
		data: { command, name: 'Insertion fixture', content: '\nOne\n\nTwo\n', access_grants: [] }
	});
	expect(created.ok()).toBe(true);
	const prompt = (await created.json()) as { id: string };
	await page.addInitScript(
		({ token }) => {
			localStorage.setItem('token', token);
			localStorage.setItem('locale', 'en-US');
			localStorage.setItem('settings', JSON.stringify({ version: '0.11.0', richTextInput: false }));
			localStorage.setItem('airis.analytics.consent.v1', 'denied');
		},
		{ token: admin.token }
	);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	try {
		await page.goto('/');
		const input = page.locator('#chat-input');
		await expect(input).toBeVisible();
		const paste = async (text: string): Promise<void> => {
			await input.evaluate((element, value) => {
				const data = new DataTransfer();
				data.setData('text/plain', value);
				data.setData('text/html', '<strong>Unwanted HTML</strong>');
				const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
				// Firefox ignores constructor-supplied clipboard data for synthetic events.
				Object.defineProperty(event, 'clipboardData', { value: data });
				element.dispatchEvent(event);
			}, text);
		};
		const text = (): Promise<string> =>
			input.evaluate((element) =>
				Array.from(element.querySelectorAll('p'))
					.map((paragraph) =>
						Array.from(paragraph.childNodes)
							.map((node) => (node.nodeName === 'BR' ? '\n' : (node.textContent ?? '')))
							.join('')
					)
					.join('\n')
			);
		for (const pasted of ['one', '\n🌍\n\ntwo\n', 'one\r\ntwo']) {
			await input.fill('left SELECT right');
			await input.evaluate((element) => {
				const node = element.querySelector('p')?.firstChild;
				if (!node) throw new Error('Missing text');
				const range = document.createRange();
				range.setStart(node, 5);
				range.setEnd(node, 11);
				window.getSelection()?.removeAllRanges();
				window.getSelection()?.addRange(range);
			});
			await paste(pasted);
			await expect.poll(text).toBe(`left ${pasted.replace(/\r\n/g, '\n')} right`);
			await input.press('X');
			await expect.poll(text).toBe(`left ${pasted.replace(/\r\n/g, '\n')}X right`);
			expect(await input.locator('strong').count()).toBe(0);
		}
		await input.fill(`left /${command} right`);
		await input.evaluate((element, length) => {
			const node = element.querySelector('p')?.firstChild;
			if (!node) throw new Error('Missing command');
			const range = document.createRange();
			range.setStart(node, length);
			range.collapse(true);
			window.getSelection()?.removeAllRanges();
			window.getSelection()?.addRange(range);
		}, 6 + command.length);
		await page.getByRole('button', { name: new RegExp(`${command}.*Insertion fixture`) }).click();
		await expect.poll(text).toBe('left \nOne\n\nTwo\n right');
		await input.press('X');
		await expect.poll(text).toBe('left \nOne\n\nTwo\nX right');
		await input.fill('first');
		await input.press('End');
		await paste('\n');
		await input.pressSequentially(`/${command}`);
		await page.getByRole('button', { name: new RegExp(`${command}.*Insertion fixture`) }).click();
		await expect.poll(text).toBe('first\n\nOne\n\nTwo\n');
		await input.fill('');
		expect(errors).toEqual([]);
	} finally {
		await request.delete(`/api/v1/prompts/id/${prompt.id}/delete`, { headers });
		await request.post('/api/v1/users/user/settings/update', { headers, data: original });
	}
});
