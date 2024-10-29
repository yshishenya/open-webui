import { WEBUI_API_BASE_URL } from '$lib/constants';

export const getConfig = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/config`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.log(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateConfig = async (token: string, config: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/config`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...config
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.log(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getAllFeedbacks = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/feedbacks/all`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.log(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

/**
 * Asynchronously exports all feedbacks from the evaluations API.
 *
 * This function fetches feedback data from the specified API endpoint and returns the result as a JSON object.
 * If the request fails, it logs the error and returns null. If an error occurs during the fetch operation,
 * it throws an error with the details of the failure.
 *
 * @param {string} [token=''] - The authorization token to access the API. Defaults to an empty string.
 * @returns {Promise<Object|null>} A promise that resolves to the feedback data as a JSON object, or null if an error occurred.
 * @throws {Error} Throws an error if the fetch operation fails and contains the error details.
 *
 * @example
 * const token = 'your-auth-token';
 * exportAllFeedbacks(token)
 *   .then(feedbacks => {
 *     if (feedbacks) {
 *       console.log('Feedbacks exported successfully:', feedbacks);
 *     } else {
 *       console.log('No feedbacks available or an error occurred.');
 *     }
 *   })
 *   .catch(error => {
 *     console.error('Error exporting feedbacks:', error);
 *   });
 */
export const exportAllFeedbacks = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/feedbacks/all/export`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.log(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const createNewFeedback = async (token: string, feedback: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/feedback`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...feedback
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.log(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getFeedbackById = async (token: string, feedbackId: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/feedback/${feedbackId}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.log(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateFeedbackById = async (token: string, feedbackId: string, feedback: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/feedback/${feedbackId}`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...feedback
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.log(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const deleteFeedbackById = async (token: string, feedbackId: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/feedback/${feedbackId}`, {
		method: 'DELETE',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.log(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};
