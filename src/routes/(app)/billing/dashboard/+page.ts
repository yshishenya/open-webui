import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const params = new URLSearchParams(url.searchParams);
	const query = params.toString();
	throw redirect(307, `/billing/balance${query ? `?${query}` : ''}`);
};
