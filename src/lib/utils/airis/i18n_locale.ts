import type { i18n } from 'i18next';

/** Match Intl formatting to the loaded UI language, including translation fallback. */
export const getI18nLocale = (value: Pick<i18n, 'resolvedLanguage' | 'language'>): string => {
	return value.resolvedLanguage || value.language || 'en-US';
};
