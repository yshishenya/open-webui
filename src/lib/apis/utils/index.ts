import { WEBUI_API_BASE_URL } from '$lib/constants';

/**
 * Asynchronously retrieves the Gravatar URL for a given email address using a provided authentication token.
 *
 * This function sends a GET request to the Gravatar API endpoint with the specified email.
 * If the request is successful, it returns the Gravatar URL. In case of an error, it logs the error
 * and returns null.
 *
 * @param {string} token - The authentication token used to authorize the request.
 * @param {string} email - The email address for which to retrieve the Gravatar URL.
 * @returns {Promise<string|null>} A promise that resolves to the Gravatar URL as a string if successful,
 *                                  or null if there was an error.
 *
 * @throws {Error} Throws an error if the response from the API is not ok, which includes
 *                 any error details returned from the API.
 *
 * @example
 * const token = 'your-auth-token';
 * const email = 'user@example.com';
 * getGravatarUrl(token, email)
 *   .then(url => {
 *     if (url) {
 *       console.log('Gravatar URL:', url);
 *     } else {
 *       console.log('Failed to retrieve Gravatar URL.');
 *     }
 *   });
 */
export const getGravatarUrl = async (token: string, email: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/utils/gravatar?email=${email}`, {
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
			error = err;
			return null;
		});

	return res;
};

/**
 * Executes a given piece of code using the specified token for authorization.
 *
 * This function sends a POST request to the WEBUI API to execute the provided code.
 * If the request is successful, it returns the result of the execution. If there is an error,
 * it logs the error and throws an exception with the error details.
 *
 * @param {string} token - The authorization token required to access the API.
 * @param {string} code - The code to be executed.
 * @returns {Promise<any>} A promise that resolves to the result of the code execution.
 * @throws {Error} Throws an error if the execution fails or if the response is not ok.
 *
 * @example
 * const token = 'your-auth-token';
 * const code = 'console.log("Hello, World!");';
 *
 * executeCode(token, code)
 *   .then(result => {
 *     console.log('Execution result:', result);
 *   })
 *   .catch(error => {
 *     console.error('Execution failed:', error);
 *   });
 */
export const executeCode = async (token: string, code: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/utils/code/execute`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			code: code
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);

			error = err;
			if (err.detail) {
				error = err.detail;
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

/**
 * Formats Python code by sending it to a specified API endpoint.
 *
 * This asynchronous function takes a token for authorization and the Python code to be formatted.
 * It sends a POST request to the API and returns the formatted code or throws an error if the request fails.
 *
 * @param {string} token - The authorization token required to access the API.
 * @param {string} code - The Python code that needs to be formatted.
 * @returns {Promise<Object|null>} A promise that resolves to the formatted code as an object, or null if an error occurs.
 * @throws {Error} Throws an error if the API response is not successful or if there is an issue with the request.
 *
 * @example
 * const token = 'your_token_here';
 * const code = 'def hello_world():\n    print("Hello, world!")';
 *
 * formatPythonCode(token, code)
 *   .then(formattedCode => {
 *     console.log(formattedCode);
 *   })
 *   .catch(error => {
 *     console.error('Error formatting code:', error);
 *   });
 */
export const formatPythonCode = async (token: string, code: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/utils/code/format`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			code: code
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);

			error = err;
			if (err.detail) {
				error = err.detail;
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

/**
 * Downloads chat messages as a PDF file.
 *
 * This asynchronous function sends a POST request to the specified API endpoint
 * to generate a PDF document containing the provided chat messages. The function
 * requires an authorization token and the title for the PDF.
 *
 * @param {string} token - The authorization token used to authenticate the request.
 * @param {string} title - The title to be included in the PDF document.
 * @param {object[]} messages - An array of message objects to be included in the PDF.
 *
 * @returns {Promise<Blob|null>} A promise that resolves to a Blob representing the PDF file,
 * or null if an error occurred during the fetch operation.
 *
 * @throws {Error} Throws an error if the response from the server is not ok,
 * containing the error details returned from the server.
 *
 * @example
 * const token = 'your-auth-token';
 * const title = 'Chat History';
 * const messages = [{ text: 'Hello', sender: 'User1' }, { text: 'Hi', sender: 'User2' }];
 *
 * downloadChatAsPDF(token, title, messages)
 *   .then(blob => {
 *     if (blob) {
 *       // Handle the blob, e.g., create a download link
 *     } else {
 *       console.error('Failed to download PDF');
 *     }
 *   });
 */
export const downloadChatAsPDF = async (token: string, title: string, messages: object[]) => {
	let error = null;

	const blob = await fetch(`${WEBUI_API_BASE_URL}/utils/pdf`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			title: title,
			messages: messages
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.blob();
		})
		.catch((err) => {
			console.log(err);
			error = err;
			return null;
		});

	return blob;
};

/**
 * Converts Markdown text to HTML by making a POST request to a specified API.
 *
 * This function takes a token for authorization and a Markdown string, sends the Markdown
 * to the API, and returns the converted HTML. If the request fails, it logs the error and
 * returns null.
 *
 * @param {string} token - The authorization token required to access the API.
 * @param {string} md - The Markdown string that needs to be converted to HTML.
 * @returns {Promise<string|null>} A promise that resolves to the converted HTML string or null if an error occurs.
 *
 * @throws {Error} Throws an error if the response from the API is not ok.
 *
 * @example
 * const token = 'your-auth-token';
 * const markdownText = '# Hello World';
 * getHTMLFromMarkdown(token, markdownText)
 *   .then(html => console.log(html))
 *   .catch(error => console.error('Error converting Markdown:', error));
 */
export const getHTMLFromMarkdown = async (token: string, md: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/utils/markdown`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			md: md
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.log(err);
			error = err;
			return null;
		});

	return res.html;
};

export const downloadDatabase = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/utils/db/download`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (response) => {
			if (!response.ok) {
				throw await response.json();
			}
			return response.blob();
		})
		.then((blob) => {
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'webui.db';
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}
};

export const downloadLiteLLMConfig = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/utils/litellm/config`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (response) => {
			if (!response.ok) {
				throw await response.json();
			}
			return response.blob();
		})
		.then((blob) => {
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'config.yaml';
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
		})
		.catch((err) => {
			console.log(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}
};
