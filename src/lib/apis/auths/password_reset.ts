import { WEBUI_API_BASE_URL } from '$lib/constants';

export type RequestPasswordResetResponse = {
	success: boolean;
	message: string;
};

export type ValidatePasswordResetTokenResponse = {
	valid: boolean;
	email: string;
};

export type ResetPasswordResponse = {
	success: boolean;
	message: string;
};

export const requestPasswordReset = async (email: string): Promise<RequestPasswordResetResponse> => {
	let error: string | null = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/request-password-reset`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ email })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return (await res.json()) as RequestPasswordResetResponse;
		})
		.catch((err: unknown) => {
			console.error(err);

			const detail = (err as { detail?: string } | null)?.detail;
			error = detail ?? 'Failed to request password reset';
			return null;
		});

	if (error) {
		throw error;
	}

	if (!res) {
		throw 'Failed to request password reset';
	}

	return res;
};

export const validatePasswordResetToken = async (
	token: string
): Promise<ValidatePasswordResetTokenResponse> => {
	let error: string | null = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/auths/validate-reset-token/${encodeURIComponent(token)}`,
		{
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return (await res.json()) as ValidatePasswordResetTokenResponse;
		})
		.catch((err: unknown) => {
			console.error(err);

			const detail = (err as { detail?: string } | null)?.detail;
			error = detail ?? 'Invalid or expired password reset token';
			return null;
		});

	if (error) {
		throw error;
	}

	if (!res) {
		throw 'Invalid or expired password reset token';
	}

	return res;
};

export const resetPassword = async (token: string, newPassword: string): Promise<ResetPasswordResponse> => {
	let error: string | null = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/reset-password`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ token, new_password: newPassword })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return (await res.json()) as ResetPasswordResponse;
		})
		.catch((err: unknown) => {
			console.error(err);

			const detail = (err as { detail?: string } | null)?.detail;
			error = detail ?? 'Failed to reset password';
			return null;
		});

	if (error) {
		throw error;
	}

	if (!res) {
		throw 'Failed to reset password';
	}

	return res;
};
