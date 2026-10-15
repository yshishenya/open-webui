// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { expect, it } from 'vitest';
import PlanForm from '../src/lib/components/admin/billing/PlanForm.svelte';

it('renders subscriber warnings safely before the original plan is available', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(PlanForm, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: {
			isEditMode: true,
			hasActiveSubscribers: true,
			originalPlan: null,
			formData: {
				name: 'fixture',
				price: 500,
				currency: 'RUB',
				interval: 'month',
				quotas: { tokens_input: 100, tokens_output: 50, requests: 10 },
				features: [],
				is_active: true,
				display_order: 0
			}
		}
	});
	try {
		await tick();
		expect(target.textContent).toContain('Plan has active subscribers');
		expect(target.querySelector<HTMLInputElement>('#plan-form-quotas-tokens_input')?.value).toBe(
			'100'
		);
		expect(target.textContent).not.toContain('Current:');
	} finally {
		await unmount(component);
		target.remove();
	}
});
