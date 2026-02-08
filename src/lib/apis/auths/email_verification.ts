import { WEBUI_API_BASE_URL } from '$lib/constants';

export type VerifyEmailResponse = {
	success: boolean;
	message: string;
	user?: {
		id: string;
		email: string;
		name: string;
		email_verified: boolean;
	};
};

export const verifyEmail = async (token: string): Promise<VerifyEmailResponse> => {
	let error: string | null = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/verify-email?token=${encodeURIComponent(token)}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return (await res.json()) as VerifyEmailResponse;
		})
		.catch((err: unknown) => {
			console.error(err);

			const detail = (err as { detail?: string } | null)?.detail;
			error = detail ?? 'Failed to verify email';
			return null;
		});

	if (error) {
		throw error;
	}

	if (!res) {
		throw 'Failed to verify email';
	}

	return res;
};
