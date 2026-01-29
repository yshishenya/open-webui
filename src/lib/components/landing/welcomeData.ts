import { presetsById } from '$lib/data/features';

export type ExampleCard = {
	title: string;
	result: string;
	badge: string;
	preset: string;
	prompt: string;
};

export type ExampleTab = {
	id: string;
	label: string;
	cards: ExampleCard[];
};

export type Step = {
	title: string;
	description: string;
};

export type FeatureCard = {
	id: string;
	title: string;
	description: string;
	examples: string[];
	preset: string;
	prompt: string;
};

export type UseCaseItem = {
	label: string;
	preset: string;
	prompt: string;
};

export type UseCase = {
	id: string;
	title: string;
	items: UseCaseItem[];
	ctaLabel: string;
	ctaPreset: string;
	ctaPrompt: string;
};

export type FaqItem = {
	id: string;
	question: string;
	answer: string;
	open?: boolean;
};

const applyPresetPrompt = <T extends { preset: string; prompt: string }>(item: T): T => {
	const presetPrompt = presetsById[item.preset]?.prompt;
	if (!presetPrompt) return item;
	return { ...item, prompt: presetPrompt };
};

const exampleTabsBase: ExampleTab[] = [
	{
		id: 'texts',
		label: 'Тексты',
		cards: [
			{
				title: 'Пост для соцсетей',
				result: '3 варианта + заголовок + хэштеги',
				badge: 'Текст',
				preset: 'social_post',
				prompt:
					'Напиши пост для соцсетей на тему: {тема}. ' +
					'Дай 3 варианта, короткий заголовок и 5 хэштегов.'
			},
			{
				title: 'Ответ на письмо',
				result: 'вежливо/делово, с аргументами',
				badge: 'Текст',
				preset: 'email_reply',
				prompt:
					'Составь ответ на письмо. Контекст: {кто пишет/о чём}. ' +
					'Тон: {вежливо/делово}. Добавь аргументы и ясную структуру.'
			},
			{
				title: 'Резюме по фактам',
				result: 'структура + сильные формулировки',
				badge: 'Текст',
				preset: 'resume',
				prompt:
					'Сделай резюме по фактам: {опыт/навыки/достижения}. ' +
					'Структура: Заголовок, О себе, Опыт, Навыки, Достижения.'
			},
			{
				title: 'Описание товара',
				result: 'коротко/подробно, в разных стилях',
				badge: 'Текст',
				preset: 'product_desc',
				prompt:
					'Напиши описание товара: {что за продукт}. Дай короткий и подробный варианты в разных стилях.'
			},
			{
				title: 'Объявление/вакансия',
				result: 'ясно и без воды',
				badge: 'Текст',
				preset: 'ad_copy',
				prompt: 'Сделай объявление или вакансию: {позиция/условия/требования}. Пиши ясно, без воды.'
			},
			{
				title: 'План презентации',
				result: 'структура слайдами + тезисы',
				badge: 'Текст',
				preset: 'presentation_plan',
				prompt:
					'Составь план презентации по теме: {тема}. Дай структуру слайдами и ключевые тезисы.'
			}
		]
	},
	{
		id: 'images',
		label: 'Изображения',
		cards: [
			{
				title: 'Картинка для поста',
				result: '4 варианта в одном стиле',
				badge: 'Картинка',
				preset: 'image_social',
				prompt:
					'Сгенерируй 4 варианта изображения для поста. Тема: {тема}. Стиль: {стиль}. Формат: квадрат.'
			},
			{
				title: 'Обложка/баннер',
				result: 'несколько композиций',
				badge: 'Картинка',
				preset: 'image_banner',
				prompt:
					'Сделай несколько композиций обложки/баннера. Тема: {тема}. Стиль: {стиль}. Формат: {формат}.'
			},
			{
				title: 'Иллюстрация к статье',
				result: 'поддерживает смысл текста',
				badge: 'Картинка',
				preset: 'image_article',
				prompt:
					'Нарисуй иллюстрацию к статье. Тема статьи: {тема}. Стиль: {стиль}. Сделай 2 варианта.'
			},
			{
				title: 'Идея логотипа (концепты)',
				result: 'несколько эскизов',
				badge: 'Картинка',
				preset: 'image_logo_concepts',
				prompt: 'Предложи 4 концепта логотипа для: {бренд}. Опиши стиль и форму. Формат: квадрат.'
			},
			{
				title: 'Стикер/персонаж',
				result: 'варианты характера',
				badge: 'Картинка',
				preset: 'image_sticker',
				prompt: 'Создай стикер/персонажа: {описание}. Дай 3 варианта позы/эмоций.'
			},
			{
				title: 'Фон/паттерн',
				result: 'чистые варианты без шума',
				badge: 'Картинка',
				preset: 'image_pattern',
				prompt: 'Сделай фон или паттерн. Тема: {тема}. Стиль: {стиль}. Формат: бесшовный.'
			}
		]
	},
	{
		id: 'study',
		label: 'Учёба',
		cards: [
			{
				title: 'Объяснить тему простыми словами',
				result: 'понятно и по шагам',
				badge: 'Учёба',
				preset: 'study_explain',
				prompt: 'Объясни тему простыми словами: {тема}. Добавь пример и короткое резюме.'
			},
			{
				title: 'Сжать текст в конспект',
				result: 'ключевые тезисы',
				badge: 'Учёба',
				preset: 'summarize_notes',
				prompt: 'Сделай конспект из текста: {текст}. Выдели ключевые тезисы и термины.'
			},
			{
				title: 'Подготовка к экзамену',
				result: 'вопросы + ответы',
				badge: 'Учёба',
				preset: 'exam_prep',
				prompt: 'Подготовь вопросы и ответы по теме: {тема}. Уровень: {уровень}.'
			},
			{
				title: 'План реферата/доклада',
				result: 'структура и пункты',
				badge: 'Учёба',
				preset: 'report_plan',
				prompt: 'Составь план реферата/доклада по теме: {тема}. Укажи разделы и тезисы.'
			},
			{
				title: 'Проверить текст на ясность',
				result: 'сделать понятнее',
				badge: 'Учёба',
				preset: 'rewrite_clear',
				prompt: 'Проверь текст на ясность и перепиши проще: {текст}. Сохрани смысл.'
			},
			{
				title: 'Перевести и объяснить',
				result: 'перевод + пояснения',
				badge: 'Учёба',
				preset: 'translate_explain',
				prompt: 'Переведи текст на русский и объясни сложные места: {текст}.'
			}
		]
	},
	{
		id: 'audio',
		label: 'Аудио',
		cards: [
			{
				title: 'Расшифровать запись',
				result: 'текст + ключевые моменты',
				badge: 'Аудио',
				preset: 'stt_transcribe',
				prompt: 'Расшифруй запись: {кратко о записи}. Выдели ключевые моменты.'
			},
			{
				title: 'Озвучить текст',
				result: 'естественный голос',
				badge: 'Аудио',
				preset: 'tts_voice',
				prompt: 'Озвучь текст: {текст}. Голос: {м/ж}, темп: {обычный}.'
			},
			{
				title: 'Сводка встречи',
				result: 'пункты и решения',
				badge: 'Аудио',
				preset: 'stt_meeting_summary',
				prompt: 'Сделай сводку встречи из расшифровки: {текст}. Выдели решения и задачи.'
			},
			{
				title: 'Субтитры к видео',
				result: 'таймкоды + текст',
				badge: 'Аудио',
				preset: 'stt_subtitles',
				prompt: 'Сделай субтитры с таймкодами для записи: {текст/распознавание}.'
			},
			{
				title: 'Выделить цитаты',
				result: '5–7 ключевых цитат',
				badge: 'Аудио',
				preset: 'stt_quotes',
				prompt: 'Выдели 5–7 ключевых цитат из расшифровки: {текст}.'
			},
			{
				title: 'Сценарий озвучки',
				result: 'готовый текст для голоса',
				badge: 'Аудио',
				preset: 'tts_script',
				prompt: 'Сделай сценарий озвучки по теме: {тема}. Тон: {дружелюбно/делово}.'
			}
		]
	}
];
export const exampleTabs: ExampleTab[] = exampleTabsBase.map((tab) => ({
	...tab,
	cards: tab.cards.map(applyPresetPrompt)
}));

export const steps: Step[] = [
	{
		title: 'Напишите задачу своими словами',
		description: 'Пост, письмо, резюме, картинка — просто одним сообщением.'
	},
	{
		title: 'Получите черновик и попросите варианты',
		description: 'Уточняйте стиль, тон, длину. Можно «сделай проще/официальнее/короче».'
	},
	{
		title: 'Доведите до финала',
		description: 'Попросите улучшить, сократить, добавить структуру — пока не будет идеально.'
	}
];

const featuresBase: FeatureCard[] = [
	{
		id: 'texts',
		title: 'Тексты',
		description: 'Посты, письма, резюме, объявления, планы.',
		examples: ['Сделать 3 варианта текста', 'Переписать проще/строже/короче'],
		preset: 'social_post',
		prompt:
			'Напиши пост для соцсетей на тему: {тема}. Дай 3 варианта, короткий заголовок и 5 хэштегов.'
	},
	{
		id: 'images',
		title: 'Изображения',
		description: 'Визуалы по описанию: для постов, идей и концептов.',
		examples: ['4 варианта в одном стиле', 'Идеи для обложки/баннера'],
		preset: 'image_social',
		prompt:
			'Сгенерируй 4 варианта изображения для поста. Тема: {тема}. Стиль: {стиль}. Формат: квадрат.'
	},
	{
		id: 'audio',
		title: 'Аудио',
		description: 'Озвучка текста и распознавание речи.',
		examples: ['Расшифровать запись', 'Озвучить текст'],
		preset: 'stt_transcribe',
		prompt: 'Расшифруй запись: {кратко о записи}. Дай текст и ключевые моменты.'
	},
	{
		id: 'code',
		title: 'Код и данные',
		description: 'Объяснить, структурировать, проверить.',
		examples: ['Разобраться с ошибкой', 'Сформировать таблицу/структуру'],
		preset: 'code_help',
		prompt: 'Помоги разобраться с задачей: {описание}. Объясни шаги и предложи решение.'
	}
];
export const features: FeatureCard[] = featuresBase.map(applyPresetPrompt);

const useCasesBase: UseCase[] = [
	{
		id: 'study',
		title: 'Учёба',
		items: [
			{
				label: 'Объяснить тему простыми словами',
				preset: 'study_explain',
				prompt: 'Объясни тему простыми словами: {тема}. Добавь пример и резюме.'
			},
			{
				label: 'Сделать конспект из текста',
				preset: 'summarize_notes',
				prompt: 'Сделай конспект из текста: {текст}. Выдели ключевые тезисы.'
			},
			{
				label: 'Подготовка к экзамену (вопросы/ответы)',
				preset: 'exam_prep',
				prompt: 'Подготовь вопросы и ответы по теме: {тема}. Уровень: {уровень}.'
			}
		],
		ctaLabel: 'Попробовать учёбу',
		ctaPreset: 'study_explain',
		ctaPrompt: 'Объясни тему простыми словами: {тема}. Добавь пример и резюме.'
	},
	{
		id: 'work',
		title: 'Работа',
		items: [
			{
				label: 'Ответ на письмо клиенту/коллеге',
				preset: 'email_reply',
				prompt:
					'Составь ответ на письмо. Контекст: {кто пишет/о чём}. Тон: деловой, но дружелюбный.'
			},
			{
				label: 'План презентации',
				preset: 'presentation_plan',
				prompt: 'Составь план презентации по теме: {тема}. Дай структуру и тезисы.'
			},
			{
				label: 'Отчёт/сводка по тексту',
				preset: 'summarize_report',
				prompt: 'Сделай короткий отчёт/сводку по тексту: {текст}. Выдели главное и выводы.'
			}
		],
		ctaLabel: 'Попробовать для работы',
		ctaPreset: 'email_reply',
		ctaPrompt: 'Составь ответ на письмо. Контекст: {кто пишет/о чём}. Тон: деловой, но дружелюбный.'
	},
	{
		id: 'creative',
		title: 'Творчество',
		items: [
			{
				label: 'Идеи и варианты текста',
				preset: 'creative_ideas',
				prompt: 'Предложи 10 идей и вариантов текста на тему: {тема}. Дай разные стили.'
			},
			{
				label: 'Картинка по описанию',
				preset: 'image_social',
				prompt: 'Сгенерируй 4 варианта изображения. Описание: {описание}. Стиль: {стиль}.'
			},
			{
				label: 'Сценарий/бриф',
				preset: 'brief_script',
				prompt: 'Сделай бриф или сценарий по теме: {тема}. Укажи цель, аудиторию и структуру.'
			}
		],
		ctaLabel: 'Попробовать для творчества',
		ctaPreset: 'creative_ideas',
		ctaPrompt: 'Предложи 10 идей и вариантов текста на тему: {тема}. Дай разные стили.'
	}
];
export const useCases: UseCase[] = useCasesBase.map((useCase) => ({
	...useCase,
	items: useCase.items.map(applyPresetPrompt),
	ctaPrompt: presetsById[useCase.ctaPreset]?.prompt ?? useCase.ctaPrompt
}));

export const faqItems: FaqItem[] = [
	{
		id: 'usage_payment',
		question: 'Как работает оплата по использованию?',
		answer:
			'Вы пополняете баланс, а списания идут только за использование сервиса ' +
			'(текст, изображения, аудио). Подписки и ежемесячных платежей нет.',
		open: true
	},
	{
		id: 'free_access',
		question: 'Есть ли бесплатный доступ?',
		answer:
			'Да. После регистрации доступен бесплатный старт с лимитами. Лимиты обновляются каждые 30 дней.'
	},
	{
		id: 'why_not_free',
		question: 'Почему не все возможности бесплатные?',
		answer:
			'Разные функции имеют разную себестоимость. Бесплатный старт помогает попробовать сервис, ' +
			'а расширенное использование оплачивается списаниями за использование.'
	},
	{
		id: 'vpn',
		question: 'Нужен ли VPN для работы?',
		answer: 'Нет, Airis работает без VPN.'
	},
	{
		id: 'topup',
		question: 'Как пополнить баланс?',
		answer:
			'В личном кабинете можно пополнить баланс фиксированными суммами ' +
			'(например, 1 000 ₽ / 1 500 ₽ / 5 000 ₽ / 10 000 ₽). После пополнения вы пользуетесь ' +
			'сервисом, а списания идут только за использование.'
	},
	{
		id: 'history',
		question: 'Где посмотреть историю списаний и остаток?',
		answer: 'Остаток баланса и история списаний доступны в личном кабинете.'
	},
	{
		id: 'text_volume',
		question: 'Что такое «текст (ввод/ответ)» и как это считается?',
		answer:
			'Текст считается по объёму: отдельно учитывается ваш запрос (ввод) и ответ модели (ответ). ' +
			'Это стандартный принцип для AI-сервисов.'
	},
	{
		id: 'business',
		question: 'Можно ли пользоваться для работы/бизнеса?',
		answer:
			'Да, Airis подходит для писем, презентаций, описаний, объявлений и других рабочих задач.'
	}
];
