import { describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import { getI18nLocale } from './i18n_locale';

describe('getI18nLocale', () => {
	it('uses the resolved translation language for unsupported selected languages', async () => {
		const instance = createInstance();
		await instance.init({
			lng: 'zz-ZZ',
			fallbackLng: 'en-US',
			resources: { 'en-US': { translation: { hello: 'Hello' } } }
		});
		expect(instance.language).toBe('zz-ZZ');
		expect(getI18nLocale(instance)).toBe('en-US');
	});

	it('uses the selected language while resource resolution is incomplete', () => {
		expect(getI18nLocale({ language: 'ru-RU', resolvedLanguage: undefined })).toBe('ru-RU');
	});

	it('uses the app default before i18next initializes', () => {
		expect(getI18nLocale(createInstance())).toBe('en-US');
	});
});
