// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it.each(['cancel', 'file', 'export', 'invalid', 'download-error', 'auth-error', 'config-error'])(
	'actual picker settles the %s path',
	async (scenario) => {
		vi.resetModules();
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		let callback: (data: Record<string, unknown>) => Promise<void>;
		class PickerBuilder {
			enableFeature(): this {
				return this;
			}
			addView(): this {
				return this;
			}
			setOAuthToken(): this {
				return this;
			}
			setDeveloperKey(): this {
				return this;
			}
			setCallback(fn: typeof callback): this {
				callback = fn;
				return this;
			}
			build(): { setVisible: () => void } {
				return {
					setVisible: () => {
						void callback({
							action: scenario === 'cancel' ? 'cancel' : 'picked',
							documents:
								scenario === 'invalid'
									? [null]
									: [
											{
												id: 'file-id',
												name: 'plan.txt',
												mimeType:
													scenario === 'export'
														? 'application/vnd.google-apps.document'
														: 'text/plain'
											}
										]
						});
					}
				};
			}
		}
		class DocsView {
			setIncludeFolders(): this {
				return this;
			}
			setSelectFolderEnabled(): this {
				return this;
			}
			setMimeTypes(): this {
				return this;
			}
		}
		vi.stubGlobal('gapi', { load: (_name: string, ready: () => void) => ready() });
		vi.stubGlobal('google', {
			accounts: {
				oauth2: {
					initTokenClient: (options: {
						callback: (response: { access_token: string }) => void;
						error_callback: (error: { message: string }) => void;
					}) => ({
						requestAccessToken: () =>
							scenario === 'auth-error'
								? options.error_callback({ message: 'OAuth denied' })
								: options.callback({ access_token: 'synthetic-token' })
					})
				}
			},
			picker: {
				PickerBuilder,
				DocsView,
				Feature: { NAV_HIDDEN: 'nav', MULTISELECT_ENABLED: 'multi' },
				Response: { ACTION: 'action', DOCUMENTS: 'documents' },
				Action: { PICKED: 'picked', CANCEL: 'cancel' },
				Document: { ID: 'id', NAME: 'name', MIME_TYPE: 'mimeType' }
			}
		});
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ google_drive: { api_key: 'synthetic-key', client_id: 'synthetic-id' } }),
					{ status: scenario === 'config-error' ? 503 : 200 }
				)
			)
			.mockResolvedValueOnce(
				new Response('document text', {
					status: scenario === 'download-error' ? 403 : 200
				})
			);
		vi.stubGlobal('fetch', fetchMock);
		const { createPicker } = await import('./google-drive-picker');
		if (scenario.endsWith('error') || scenario === 'invalid') {
			await expect(createPicker()).rejects.toThrow(
				scenario === 'config-error'
					? 'Failed to fetch'
					: scenario === 'auth-error'
						? 'OAuth denied'
						: scenario === 'invalid'
							? 'Required file details missing'
							: 'Failed to download file (403)'
			);
		} else if (scenario === 'cancel') {
			expect(await createPicker()).toBeNull();
			expect(fetchMock).toHaveBeenCalledOnce();
		} else {
			const file = await createPicker();
			expect(file?.id).toBe('file-id');
			expect(file?.name).toBe('plan.txt');
			expect(await file?.blob.text()).toBe('document text');
			expect(fetchMock).toHaveBeenLastCalledWith(
				`https://www.googleapis.com/drive/v3/files/file-id${scenario === 'export' ? '/export?mimeType=text%2Fplain' : '?alt=media'}`,
				{ headers: { Authorization: 'Bearer synthetic-token', Accept: '*/*' } }
			);
		}
	}
);
