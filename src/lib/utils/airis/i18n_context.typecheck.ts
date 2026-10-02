// Compile with tsc --noEmit --strict --skipLibCheck --moduleResolution bundler
// --module ESNext --target ES2022 --esModuleInterop --resolveJsonModule
// src/lib/utils/airis/i18n_context.{d.ts,typecheck.ts}
import { getContext } from 'svelte';
import type i18n from '../../i18n';

type Assert<T extends true> = T;
type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const translations = getContext('i18n');
export type TranslationContextMatchesStore = Assert<Equal<typeof translations, typeof i18n>>;
translations.subscribe((value) => value.t('Hello'));
// @ts-expect-error Context holds i18next, not a primitive.
translations.set(123);

export const numberContext = getContext<number>('explicit-number');
export type GenericContextPreserved = Assert<Equal<typeof numberContext, number>>;

const unknownContext = getContext('another-key');
export type UnknownContextPreserved = Assert<Equal<typeof unknownContext, unknown>>;
// @ts-expect-error Unrecognised contexts are not assumed to be stores.
unknownContext.subscribe(() => {});
