// Used API from the installed file-saver 2.0.5 README.
declare module 'file-saver' {
	export function saveAs(
		data: Blob | string,
		filename?: string,
		options?: { autoBom?: boolean }
	): void;

	const fileSaver: typeof saveAs & { saveAs: typeof saveAs };
	export default fileSaver;
}
