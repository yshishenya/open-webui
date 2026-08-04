// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { buildModelMutationPayload } from '$lib/utils/airis/model_payload';

describe('buildModelMutationPayload', () => {
	it('omits null grants so metadata updates preserve existing ACLs', () => {
		const payload = buildModelMutationPayload({
			name: 'Luna',
			meta: { lead_magnet: true },
			params: {},
			access_grants: null
		}, 'gpt-5.6-luna');

		expect(payload).toEqual({
			id: 'gpt-5.6-luna',
			name: 'Luna',
			meta: { lead_magnet: true },
			params: {}
		});
	});

	it('keeps an explicit empty list and removes malformed entries', () => {
		expect(
			buildModelMutationPayload({
				access_grants: [null, { principal_type: 'user' }, 'invalid', 42]
			})
		).toEqual({ access_grants: [{ principal_type: 'user' }] });

		expect(buildModelMutationPayload({ access_grants: [] })).toEqual({ access_grants: [] });
	});
});
