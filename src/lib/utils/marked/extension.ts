import { decode } from 'html-entities';
import { type Token, type TokenizerThis, type Tokens } from 'marked';

// Helper function to find matching closing tag
function findMatchingClosingTag(src: string, openTag: string, closeTag: string): number {
	let depth = 1;
	let index = openTag.length;
	while (depth > 0 && index < src.length) {
		if (src.startsWith(openTag, index)) {
			depth++;
		} else if (src.startsWith(closeTag, index)) {
			depth--;
		}
		if (depth > 0) {
			index++;
		}
	}
	return depth === 0 ? index + closeTag.length : -1;
}

// Function to parse attributes from tag
function parseAttributes(tag: string): { [key: string]: string } {
	const attributes: { [key: string]: string } = {};
	const attrRegex = /(\w+)="(.*?)"/g;
	let match;
	while ((match = attrRegex.exec(tag)) !== null) {
		attributes[match[1]] = match[2];
	}
	return attributes;
}

function detailsTokenizer(this: TokenizerThis, src: string) {
	// Updated regex to capture attributes inside <details>
	const detailsRegex = /^<details(\s+[^>]*)?>\n/;
	const summaryRegex = /^<summary>(.*?)<\/summary>\n/;

	const detailsMatch = detailsRegex.exec(src);
	if (detailsMatch) {
		const endIndex = findMatchingClosingTag(src, '<details', '</details>');
		if (endIndex === -1) return;

		const fullMatch = src.slice(0, endIndex);
		const detailsTag = detailsMatch[0];
		const attributes = parseAttributes(detailsTag); // Parse attributes from <details>

		let content = fullMatch.slice(detailsTag.length, -10).trim(); // Remove <details> and </details>
		let summary = '';

		const summaryMatch = summaryRegex.exec(content);
		if (summaryMatch) {
			summary = summaryMatch[1].trim();
			content = content.slice(summaryMatch[0].length).trim();
		}

		const tokens: Token[] = [];
		if (attributes.type !== 'tool_calls') {
			this.lexer.blockTokens(decode(content), tokens);
		}

		return {
			type: 'details',
			raw: fullMatch,
			summary: summary,
			text: content,
			tokens,
			attributes: attributes // Include extracted attributes from <details>
		};
	}
}

function detailsStart(src: string) {
	return src.match(/^<details[\s>]/) ? 0 : -1;
}

function lheadingTokenizer(
	this: TokenizerThis & { rules: { block: { lheading: RegExp } } },
	src: string
): Tokens.Paragraph | false {
	const cap = this.rules.block.lheading.exec(src);
	const detailsIndex = cap?.[1]?.search(/\n<details[\s>]/) ?? -1;
	if (!cap || detailsIndex === -1) return false;

	const raw = cap[1].slice(0, detailsIndex + 1);
	const text = raw.slice(0, -1);
	return {
		type: 'paragraph',
		raw,
		text,
		tokens: this.lexer.inline(text)
	};
}

function detailsRenderer(token: NonNullable<ReturnType<typeof detailsTokenizer>>): string {
	const attributesString = token.attributes
		? Object.entries(token.attributes)
				.map(([key, value]) => `${key}="${value}"`)
				.join(' ')
		: '';

	return `<details ${attributesString}>
  ${token.summary ? `<summary>${token.summary}</summary>` : ''}
  ${token.text}
  </details>`;
}

// Extension wrapper function
function detailsExtension() {
	return {
		name: 'details',
		level: 'block' as const,
		start: detailsStart,
		tokenizer: detailsTokenizer,
		renderer: detailsRenderer
	};
}

function underlineRenderer(this: { parser: { parseInline(tokens: Token[]): string } }, token: { tokens: Token[] }): string {
	return `<u>${this.parser.parseInline(token.tokens)}</u>`;
}

function underlineExtension() {
	return {
		name: 'underline',
		level: 'inline' as const,
		start: (src: string) => src.indexOf('<u>'),
		tokenizer(this: TokenizerThis, src: string) {
			const match = /^<u>([\s\S]+?)<\/u>/.exec(src);
			if (!match) return;

			return {
				type: 'underline',
				raw: match[0],
				text: match[1],
				tokens: this.lexer.inlineTokens(match[1])
			};
		},
		renderer: underlineRenderer
	};
}

export default function (options: Record<string, unknown> = {}) {
	void options;
	return {
		tokenizer: {
			// Marked accepts a paragraph here; its built-in callback type only lists headings.
			lheading: lheadingTokenizer as NonNullable<
				NonNullable<MarkedExtension['tokenizer']>['lheading']
			>
		},
		extensions: [detailsExtension(), underlineExtension()]
	};
}
import type { MarkedExtension } from 'marked';
