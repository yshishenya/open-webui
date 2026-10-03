/** Report a committed write separately from a refresh: retrying a committed create duplicates it. */
export async function performGroupMutation(
	write: () => Promise<unknown>,
	onSuccess: () => void,
	refresh: () => void | Promise<void>,
	onError: (error: unknown) => void,
	failureMessage: string
): Promise<boolean> {
	try {
		if (!(await write())) {
			onError(failureMessage);
			return false;
		}
	} catch (error) {
		onError(error);
		return false;
	}

	onSuccess();
	try {
		await refresh();
	} catch (error) {
		onError(error);
	}
	return true;
}
