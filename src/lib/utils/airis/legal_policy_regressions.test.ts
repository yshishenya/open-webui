import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const policyFiles = [
	'src/routes/privacy/+page.svelte',
	'src/routes/documents/consent/+page.svelte',
	'src/routes/documents/cookies/+page.svelte',
	'src/routes/documents/subprocessors/+page.svelte',
	'src/routes/documents/dpa/+page.svelte'
];
const legalDocsFile = 'backend/open_webui/utils/airis/legal_docs.py';
const legalGateFile = 'src/lib/components/layout/Overlay/LegalAcceptanceGate.svelte';

describe('public legal policy regressions', () => {
	it('records the analytics policy update without changing unrelated legal versions', async () => {
		const pages = await Promise.all(policyFiles.map((path) => readFile(path, 'utf8')));
		for (const [index, page] of pages.entries()) {
			const version = policyFiles[index].includes('/cookies/') ? '2026-10-02' : '2026-08-23';
			expect(page).toContain(`const docVersion = '${version}'`);
			const date = policyFiles[index].includes('/cookies/') ? '2 октября 2026' : '23 августа 2026';
			expect(page).toContain(`const lastUpdated = '${date}'`);
		}
	});

	it('keeps critical data-flow disclosures and removes unverified promises', async () => {
		const [privacy, consent, cookies, providers, dpa] = await Promise.all(
			policyFiles.map((path) => readFile(path, 'utf8'))
		);
		const fullPack = [privacy, consent, cookies, providers, dpa].join('\n');
		const operatorAddress =
			'623701, Свердловская область, г. Березовский, ул. Спортивная, д. 8, кв. 87';

		for (const document of [privacy, consent, dpa]) {
			expect(document.replace(/\s+/g, ' ')).toContain(operatorAddress);
		}

		expect(privacy).toMatch(
			/Email\s+аккаунта и\s+платёжные данные\s+в контент\s+AI‑запроса\s+автоматически не добавляются/
		);
		expect(privacy).toMatch(/баз данных на территории\s+Российской Федерации/);
		expect(privacy).toMatch(
			/непосредственно поставщику\s+либо через\s+управляемый AIRIS технический\s+шлюз/
		);
		expect(privacy).toMatch(/может являться\s+трансграничной/);
		expect(consent).toContain('согласие подтверждается отдельно от оферты');
		expect(consent).toContain('базе AIRIS на территории');
		expect(consent).toContain('Такая передача иностранным получателям является трансграничной');
		expect(cookies).toContain('поле сообщения');
		expect(cookies).toContain('Аналитика включена по умолчанию');
		expect(cookies.replace(/\s+/g, ' ')).toContain(
			'Ранее сохранённый запрет продолжает действовать'
		);
		expect(cookies).toContain('Яндекс Метрику и PostHog');
		expect(providers).toContain("name: 'Российские хостинг-провайдеры'");
		expect(providers).toContain("name: 'Технические инфраструктурные подрядчики'");
		expect(providers).toContain("name: 'Внешние AI‑поставщики и поставщики моделей'");
		expect(providers).toContain("name: 'Платёжные сервисы'");
		expect(providers).toContain("name: 'Сервисы внешней авторизации'");
		expect(providers).toContain(
			'передача получателю за пределы Российской Федерации может быть трансграничной'
		);
		expect(fullPack).not.toContain('OpenRouter передаёт запрос разработчику выбранной модели');
		expect(fullPack).not.toContain('Через этот шлюз проходят все обращения');
		expect(fullPack).not.toContain('American Cloud LLC');
		for (const infrastructureDetail of [
			'HOSTKEY',
			'VDSka',
			'EGIHosting',
			'litellm.pro-4.ru',
			'771877161189',
			'Черкизовская Б.',
			'Сервер находится в США',
			'сервер — США',
			'шлюз AIRIS в США',
			'OpenAI',
			'Anthropic',
			'Google Gemini',
			'DeepSeek',
			'OpenRouter',
			'DuckDuckGo',
			'YooKassa',
			'VK ID',
			'Telegram',
			'GitHub',
			'США',
			'Китай'
		]) {
			expect(fullPack).not.toContain(infrastructureDetail);
		}
		expect(providers).not.toContain("name: 'Яндекс 360 / SMTP");
		expect(dpa).not.toContain('остаются изолированными');
		expect(fullPack).not.toContain('Мониторинг безопасности 24/7');
		expect(fullPack).not.toContain('Шифрование данных при хранении');
		expect(fullPack).not.toContain('процедуры реагирования на инциденты');
		expect(fullPack).not.toContain('стремимся хранить');
		expect(fullPack).not.toContain('Сервис предназначен для лиц');
	});

	it('requires a separate personal-data consent with distinct UI wording', async () => {
		const [legalDocs, legalGate] = await Promise.all(
			[legalDocsFile, legalGateFile].map((path) => readFile(path, 'utf8'))
		);

		expect(legalDocs).toContain('key="personal_data_consent"');
		expect(legalDocs).toContain('url="/documents/consent"');
		expect(legalGate).toContain("doc.key === 'personal_data_consent'");
		expect(legalGate).toContain('Я даю согласие');
	});
});
