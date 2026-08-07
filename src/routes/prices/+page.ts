import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = () => {
	throw redirect(308, '/pricing');
};
