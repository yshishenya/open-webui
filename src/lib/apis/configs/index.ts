import { WEBUI_API_BASE_URL } from '$lib/constants';
import type { Banner } from '$lib/types';

export const importConfig = async (token: string, config) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/import`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			config: config
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const exportConfig = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/export`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

/**
 * Fetches the configuration for direct connections from the Web UI API.
 *
 * This asynchronous function retrieves the direct connections configuration
 * by making a GET request to the specified API endpoint. It requires a valid
 * authorization token to access the resource. If the request is unsuccessful,
 * an error is thrown with details about the failure.
 *
 * @param {string} token - The authorization token used to authenticate the request.
 * @returns {Promise<Object|null>} A promise that resolves to the direct connections
 * configuration object if successful, or null if an error occurs.
 *
 * @throws {Object} Throws an error object containing details of the failure if the
 * request is not successful.
 *
 * @example
 * const token = 'your-auth-token';
 * getDirectConnectionsConfig(token)
 *   .then(config => {
 *     console.log('Direct Connections Config:', config);
 *   })
 *   .catch(error => {
 *     console.error('Error fetching config:', error);
 *   });
 */
export const getDirectConnectionsConfig = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/direct_connections`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

/**
 * Sends a configuration for direct connections to the server.
 *
 * This asynchronous function makes a POST request to the specified API endpoint
 * with the provided token for authorization and the configuration object as the body.
 * If the request is successful, it returns the response data. If an error occurs,
 * it logs the error and throws an exception with the error details.
 *
 * @param {string} token - The authorization token to access the API.
 * @param {object} config - The configuration object to be sent in the request body.
 * @returns {Promise<object|null>} A promise that resolves to the response data if successful,
 *                                  or null if an error occurred.
 * @throws {Error} Throws an error if the response is not ok or if there is an issue
 *                 during the fetch operation.
 *
 * @example
 * const token = 'your_token_here';
 * const config = { key: 'value' };
 * setDirectConnectionsConfig(token, config)
 *   .then(response => {
 *     console.log('Configuration set successfully:', response);
 *   })
 *   .catch(error => {
 *     console.error('Error setting configuration:', error);
 *   });
 */
export const setDirectConnectionsConfig = async (token: string, config: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/direct_connections`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
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
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

/**
 * Fetches the configuration for the code interpreter from the API.
 *
 * This function makes an asynchronous GET request to the code interpreter configuration endpoint.
 * It requires a valid authorization token to access the resource. If the request is successful,
 * it returns the configuration data as a JSON object. If the request fails, it logs the error
 * and throws an exception with the error details.
 *
 * @param {string} token - The authorization token required to access the API.
 * @returns {Promise<Object|null>} A promise that resolves to the configuration object if successful,
 *                                  or null if there was an error during the fetch operation.
 * @throws {Error} Throws an error if the response from the API is not ok or if there is an issue
 *                 during the fetch operation.
 *
 * @example
 * const token = 'your-auth-token';
 * getCodeInterpreterConfig(token)
 *   .then(config => {
 *     console.log('Configuration:', config);
 *   })
 *   .catch(error => {
 *     console.error('Error fetching configuration:', error);
 *   });
 */
export const getCodeInterpreterConfig = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/code_interpreter`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

/**
 * Asynchronously sets the configuration for the code interpreter.
 *
 * This function sends a POST request to the code interpreter configuration endpoint
 * with the provided token and configuration object. If the request is successful,
 * it returns the response data. If an error occurs during the request, it logs the
 * error and throws an exception with the error details.
 *
 * @param {string} token - The authorization token required to access the API.
 * @param {object} config - The configuration object containing settings for the code interpreter.
 *
 * @returns {Promise<object|null>} A promise that resolves to the response data if successful,
 *                                  or null if an error occurred.
 *
 * @throws {Error} Throws an error if the response from the server indicates a failure.
 *
 * @example
 * const token = 'your-auth-token';
 * const config = { setting1: 'value1', setting2: 'value2' };
 *
 * setCodeInterpreterConfig(token, config)
 *   .then(response => {
 *     console.log('Configuration set successfully:', response);
 *   })
 *   .catch(error => {
 *     console.error('Error setting configuration:', error);
 *   });
 */
export const setCodeInterpreterConfig = async (token: string, config: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/code_interpreter`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
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
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getModelsConfig = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/models`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const setModelsConfig = async (token: string, config: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/models`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
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
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const setDefaultPromptSuggestions = async (token: string, promptSuggestions: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/suggestions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			suggestions: promptSuggestions
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getBanners = async (token: string): Promise<Banner[]> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/banners`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const setBanners = async (token: string, banners: Banner[]) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/banners`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			banners: banners
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};
