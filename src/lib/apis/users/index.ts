import { WEBUI_API_BASE_URL } from '$lib/constants';
import { getUserPosition } from '$lib/utils';

export const getUserGroups = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/groups`, {
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

export const getUserDefaultPermissions = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/default/permissions`, {
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

export const updateUserDefaultPermissions = async (token: string, permissions: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/default/permissions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...permissions
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

export const updateUserRole = async (token: string, id: string, role: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/update/role`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			id: id,
			role: role
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

export const getUsers = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/`, {
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

	return res ? res : [];
};

export const getUserSettings = async (token: string) => {
	let error = null;
	const res = await fetch(`${WEBUI_API_BASE_URL}/users/user/settings`, {
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

export const updateUserSettings = async (token: string, settings: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/user/settings/update`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...settings
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

export const getUserById = async (token: string, userId: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/${userId}`, {
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

export const getUserInfo = async (token: string) => {
	let error = null;
	const res = await fetch(`${WEBUI_API_BASE_URL}/users/user/info`, {
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

export const updateUserInfo = async (token: string, info: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/user/info/update`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...info
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
 * Asynchronously retrieves the user's current location and updates the user's information with it.
 *
 * This function first attempts to get the user's position using the `getUserPosition` function.
 * If successful, it updates the user's information by calling `updateUserInfo` with the provided token
 * and the retrieved location. If the location cannot be obtained, it logs an error message and returns null.
 *
 * @param {string} token - The authentication token used to update the user's information.
 * @returns {Promise<null | Geolocation>} A promise that resolves to the user's location if successful,
 * or null if the location could not be retrieved.
 *
 * @throws {Error} Throws an error if there is an issue with retrieving the user's position or updating user info.
 *
 * @example
 * const token = 'your-auth-token';
 * getAndUpdateUserLocation(token)
 *   .then(location => {
 *     if (location) {
 *       console.log('User location updated:', location);
 *     } else {
 *       console.log('Could not update user location.');
 *     }
 *   })
 *   .catch(error => {
 *     console.error('Error updating user location:', error);
 *   });
 */
export const getAndUpdateUserLocation = async (token: string) => {
	const location = await getUserPosition().catch((err) => {
		console.log(err);
		return null;
	});

	if (location) {
		await updateUserInfo(token, { location: location });
		return location;
	} else {
		console.log('Failed to get user location');
		return null;
	}
};

export const deleteUserById = async (token: string, userId: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/${userId}`, {
		method: 'DELETE',
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

type UserUpdateForm = {
	profile_image_url: string;
	email: string;
	name: string;
	password: string;
};

export const updateUserById = async (token: string, userId: string, user: UserUpdateForm) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/users/${userId}/update`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			profile_image_url: user.profile_image_url,
			email: user.email,
			name: user.name,
			password: user.password !== '' ? user.password : undefined
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
