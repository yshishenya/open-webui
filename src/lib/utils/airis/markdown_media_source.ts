import DOMPurify from 'dompurify';

export const getMarkdownMediaSource = (html: string, kind: 'video' | 'audio'): string | null => {
	const media = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true }).querySelector(kind);
	const source = media?.getAttribute('src') ?? media?.textContent?.trim();
	if (!source) return null;

	// Legacy inner text becomes a URL: apply the same URI policy as an HTML src attribute.
	const candidate = document.createElement(kind);
	candidate.setAttribute('src', source);
	return (
		DOMPurify.sanitize(candidate, { RETURN_DOM_FRAGMENT: true })
			.querySelector(kind)
			?.getAttribute('src') ?? null
	);
};
