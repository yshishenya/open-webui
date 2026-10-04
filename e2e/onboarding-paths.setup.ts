import { expect, request, type FullConfig } from '@playwright/test';

export default async function setup(config: FullConfig): Promise<void> {
	const baseURL = config.projects[0].use.baseURL;
	if (!baseURL || new URL(baseURL).hostname !== 'onboarding-paths')
		throw new Error('Full-path tests require the disposable onboarding-paths Compose service');
	const client = await request.newContext({ baseURL });
	try {
		const credentials = { email: 'fullpaths-admin@airis.you', password: 'local-fixture-only' };
		let signin = await client.post('/api/v1/auths/signin', { data: credentials });
		if (!signin.ok()) {
			const signup = await client.post('/api/v1/auths/signup', {
				data: {
					...credentials,
					name: 'Local fixture admin',
					terms_accepted: true,
					privacy_accepted: true
				}
			});
			expect(signup.ok()).toBe(true);
			signin = await client.post('/api/v1/auths/signin', { data: credentials });
		}
		expect(signin.ok()).toBe(true);
		const admin = (await signin.json()) as { role: string; token: string };
		expect(admin.role).toBe('admin');
		const headers = { Authorization: `Bearer ${admin.token}` };
		const current = await client.get('/api/v1/auths/admin/config', { headers });
		expect(current.ok()).toBe(true);
		const registration = await client.post('/api/v1/auths/admin/config', {
			headers,
			data: { ...(await current.json()), ENABLE_SIGNUP: true, DEFAULT_USER_ROLE: 'user' }
		});
		expect(registration.ok()).toBe(true);
		const models = await client.get('/api/v1/models/base', { headers });
		expect(models.ok()).toBe(true);
		if (!((await models.json()) as { id: string }[]).some((model) => model.id === 'gpt-5.6-luna')) {
			const created = await client.post('/api/v1/models/create', {
				headers,
				data: {
					id: 'gpt-5.6-luna',
					name: 'gpt-5.6-luna',
					meta: { lead_magnet: true },
					params: {},
					access_grants: [{ principal_type: 'user', principal_id: '*', permission: 'read' }]
				}
			});
			expect(created.ok()).toBe(true);
		}
		for (const unit of ['token_in', 'token_out']) {
			const existing = await client.get('/api/v1/admin/billing/rate-card', {
				headers,
				params: { model_id: 'gpt-5.6-luna', unit, is_active: true }
			});
			expect(existing.ok()).toBe(true);
			if (((await existing.json()) as { items: object[] }).items.length) continue;
			const created = await client.post('/api/v1/admin/billing/rate-card', {
				headers,
				data: {
					model_id: 'gpt-5.6-luna',
					modality: 'text',
					unit,
					raw_cost_per_unit_kopeks: 1,
					is_active: true
				}
			});
			expect(created.ok()).toBe(true);
		}
	} finally {
		await client.dispose();
	}
}
