// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

const source = readFileSync(
	'src/lib/components/chat/Settings/Account/UserProfileImage.svelte',
	'utf8'
);
const handler = source.match(/on:change=\{([\s\S]*?)\n\t\}\}/)?.[1];
if (!handler) throw new Error('Profile photo input handler missing');

const upload = (hasContext: boolean) => {
	const errors: string[] = [];
	const draws: number[][] = [];
	const exports: (string | number)[][] = [];
	const input = { files: [{ type: 'image/png' }], value: 'photo.png' };
	const runtime = runInNewContext(
		ts.transpileModule(`const change = ${handler}\n}; change(); ({profileImageUrl});`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		{
			profileImageUrl: 'previous-avatar',
			photo: { revision: 1, reader: null },
			cancelPhoto: () => 1,
			profileImageInputElement: input,
			$i18n: { t: (key: string): string => key },
			toast: {
				error: (message: string): void => {
					errors.push(message);
				}
			},
			FileReader: class {
				result = 'data:image/png;synthetic';
				onload: ((event: { target: { result: string } }) => void) | null = null;
				readAsDataURL(): void {
					this.onload?.({ target: { result: this.result } });
				}
			},
			Image: class {
				width = 500;
				height = 250;
				src = '';
				set onload(callback: () => void) {
					callback();
				}
			},
			document: {
				createElement: () => ({
					width: 0,
					height: 0,
					getContext: () =>
						hasContext
							? {
									drawImage: (_image: object, ...dimensions: number[]): void => {
										draws.push(dimensions);
									}
								}
							: null,
					toDataURL(format: string, quality: number): string {
						exports.push([this.width, this.height, format, quality]);
						return 'data:image/webp;compressed';
					}
				})
			}
		}
	) as { profileImageUrl: string };
	return { runtime, input, errors, draws, exports };
};

it('preserves the avatar and clears the input for retry without Canvas', () => {
	const result = upload(false);
	expect(result.errors).toEqual(['Failed to upload file.']);
	expect(result.runtime.profileImageUrl).toBe('previous-avatar');
	expect(result.input.value).toBe('');
	expect(result.draws).toEqual([]);
	expect(result.exports).toEqual([]);
});

it('retains the centered 250px cover crop and WebP compression', () => {
	const result = upload(true);
	expect(result.errors).toEqual([]);
	expect(result.runtime.profileImageUrl).toBe('data:image/webp;compressed');
	expect(result.input.value).toBe('');
	expect(result.draws).toEqual([[-125, 0, 500, 250]]);
	expect(result.exports).toEqual([[250, 250, 'image/webp', 0.8]]);
});
