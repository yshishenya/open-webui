import { chromium, request, type APIRequestContext } from '@playwright/test';
import { adminUser } from './helpers/auth';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const storageStatePath = path.join('e2e', '.auth', 'admin.json');
const signupUrl = new URL('/api/v1/auths/signup', baseURL).toString();
const signinUrl = new URL('/api/v1/auths/signin', baseURL).toString();
const EMAIL_TAKEN_DETAIL =
	"Uh-oh! This email is already registered. Sign in with your existing account or choose another email to start anew.";

const sleep = async (ms: number): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, ms));
};

const waitForBackend = async (requestContext: APIRequestContext): Promise<void> => {
	const deadline = Date.now() + 60_000;
	let lastError: unknown = null;

	while (Date.now() < deadline) {
		try {
			const healthResponse = await requestContext.get('/health');
			if (healthResponse.ok()) {
				return;
			}
			lastError = new Error(`Backend not healthy yet: status=${healthResponse.status()}`);
		} catch (error) {
			lastError = error;
		}
		await sleep(500);
	}

	throw new Error(`Backend did not become ready within 60s: ${String(lastError)}`);
};

const acceptLegalGateIfPresent = async (page: import('@playwright/test').Page): Promise<void> => {
	const deadline = Date.now() + 30_000;
	const gateContainer = page.getByText('Примите условия, чтобы продолжить');

	while (Date.now() < deadline) {
		if ((await gateContainer.count()) > 0) {
			break;
		}
		await sleep(250);
	}

	if ((await gateContainer.count()) === 0) {
		return;
	}

	const legalGate = page
		.locator('.fixed.w-full.h-full.flex')
		.filter({ has: gateContainer });
	const checkboxes = legalGate.locator('input[type="checkbox"]');
	const checkboxCount = await checkboxes.count();
	for (let i = 0; i < checkboxCount; i++) {
		const checkbox = checkboxes.nth(i);
		if (!(await checkbox.isChecked())) {
			await checkbox.check();
		}
	}

	const acceptButton = legalGate.getByRole('button', {
		name: /Принять и продолжить|Accept and continue/i
	});
	if ((await acceptButton.count()) > 0) {
		await acceptButton.first().click();
	}

	await gateContainer.waitFor({ state: 'detached', timeout: 30_000 }).catch(() => undefined);
};

const globalSetup = async (): Promise<void> => {
	const requestContext = await request.newContext({ baseURL });
	await waitForBackend(requestContext);

	let user = adminUser;

	const signinResponse = await requestContext.post(signinUrl, {
		data: { email: user.email, password: user.password }
	});
	if (!signinResponse.ok() && signinResponse.status() != 400) {
		const payload = (await signinResponse.json().catch(() => null)) as { detail?: string } | null;
		throw new Error(
			`User signin failed: status=${signinResponse.status()} detail=${payload?.detail ?? 'unknown'}`
		);
	}

	// If login fails (400 invalid creds), try to create the user when signup is allowed.
	if (!signinResponse.ok()) {
		const signupResponse = await requestContext.post(signupUrl, {
			data: { ...user, terms_accepted: true, privacy_accepted: true }
		});

		if (signupResponse.status() === 400) {
			const payload = (await signupResponse.json().catch(() => null)) as { detail?: string } | null;
			if (payload?.detail === EMAIL_TAKEN_DETAIL) {
				// If someone already has `admin@example.com` but with unknown password, create a unique
				// user so the rest of the e2e suite can still run.
				user = { ...adminUser, email: `e2e+${Date.now()}@example.com` };
				const retrySignupResponse = await requestContext.post(signupUrl, {
					data: { ...user, terms_accepted: true, privacy_accepted: true }
				});
				if (!retrySignupResponse.ok()) {
					throw new Error(`User signup failed: status=${retrySignupResponse.status()}`);
				}
			} else {
				throw new Error(`User signup failed: status=400 detail=${payload?.detail ?? 'unknown'}`);
			}
		} else if (signupResponse.status() === 403) {
			throw new Error('User signup is disabled and signin failed (invalid credentials)');
		} else if (!signupResponse.ok()) {
			throw new Error(`User signup failed: status=${signupResponse.status()}`);
		}

		const retrySigninResponse = await requestContext.post(signinUrl, {
			data: { email: user.email, password: user.password }
		});
		if (!retrySigninResponse.ok()) {
			const payload = (await retrySigninResponse.json().catch(() => null)) as { detail?: string } | null;
			throw new Error(
				`User signin failed after signup: status=${retrySigninResponse.status()} detail=${payload?.detail ?? 'unknown'}`
			);
		}

		const retrySigninPayload = (await retrySigninResponse.json()) as { token?: string };
		const retryToken = retrySigninPayload.token;
		if (!retryToken) {
			throw new Error('User signin failed after signup: missing token in response payload');
		}

		await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
		await requestContext.storageState({ path: storageStatePath });
		await requestContext.dispose();

		const browser = await chromium.launch();
		const context = await browser.newContext({ storageState: storageStatePath });
		const page = await context.newPage();

		await page.addInitScript((authToken: string) => {
			window.localStorage.setItem('token', authToken);
			window.localStorage.setItem('locale', 'en-US');
		}, retryToken);

		await page.goto(new URL('/', baseURL).toString());
		const changelogButton = page.getByRole('button', { name: "Okay, Let's Go!" });
		if ((await changelogButton.count()) > 0) {
			await changelogButton.click();
		}

		await context.storageState({ path: storageStatePath });
		await browser.close();
		return;
	}

	const signinPayload = (await signinResponse.json()) as { token?: string };
	const token = signinPayload.token;
	if (!token) {
		throw new Error('User signin failed: missing token in response payload');
	}

	await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
	await requestContext.storageState({ path: storageStatePath });
	await requestContext.dispose();

	// Optional: open a page once to handle possible first-run UI modals, then re-save state.
	const browser = await chromium.launch();
	const context = await browser.newContext({ storageState: storageStatePath });
	const page = await context.newPage();

	await page.addInitScript((authToken: string) => {
		window.localStorage.setItem('token', authToken);
		window.localStorage.setItem('locale', 'en-US');
	}, token);

	await page.goto(new URL('/', baseURL).toString());
	const changelogButton = page.getByRole('button', { name: "Okay, Let's Go!" });
	if ((await changelogButton.count()) > 0) {
		await changelogButton.click();
	}
	const whatsNewDialog = page.getByRole('dialog').filter({ hasText: "What's New" });
	const whatsNewCloseButton = whatsNewDialog.getByRole('button', { name: 'Close' });
	if ((await whatsNewCloseButton.count()) > 0) {
		await whatsNewCloseButton.first().click();
	}
	await acceptLegalGateIfPresent(page);

	await context.storageState({ path: storageStatePath });
	await browser.close();
};

export default globalSetup;
