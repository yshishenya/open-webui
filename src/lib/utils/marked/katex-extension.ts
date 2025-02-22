import katex from 'katex';

const DELIMITER_LIST = [
	{ left: '$$', right: '$$', display: true },
	{ left: '$', right: '$', display: false },
	{ left: '\\pu{', right: '}', display: false },
	{ left: '\\ce{', right: '}', display: false },
	{ left: '\\(', right: '\\)', display: false },
	{ left: '\\[', right: '\\]', display: true },
	{ left: '\\begin{equation}', right: '\\end{equation}', display: true }
];

// const DELIMITER_LIST = [
//     { left: '$$', right: '$$', display: false },
//     { left: '$', right: '$', display: false },
// ];

// const inlineRule = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1(?=[\s?!\.,:？！。，：]|$)/;
// const blockRule = /^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;

let inlinePatterns = [];
let blockPatterns = [];

function escapeRegex(string) {
	return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function generateRegexRules(delimiters) {
	delimiters.forEach((delimiter) => {
		const { left, right, display } = delimiter;
		// Ensure regex-safe delimiters
		const escapedLeft = escapeRegex(left);
		const escapedRight = escapeRegex(right);

		if (!display) {
			// For inline delimiters, we match everything
			inlinePatterns.push(`${escapedLeft}((?:\\\\[^]|[^\\\\])+?)${escapedRight}`);
		} else {
			// Block delimiters doubles as inline delimiters when not followed by a newline
			inlinePatterns.push(`${escapedLeft}(?!\\n)((?:\\\\[^]|[^\\\\])+?)(?!\\n)${escapedRight}`);
			blockPatterns.push(`${escapedLeft}\\n((?:\\\\[^]|[^\\\\])+?)\\n${escapedRight}`);
		}
	});

	// Math formulas can end in special characters
	const inlineRule = new RegExp(
		`^(${inlinePatterns.join('|')})(?=[\\s?。，!-\/:-@[-\`{-~]|$)`,
		'u'
	);
	const blockRule = new RegExp(`^(${blockPatterns.join('|')})(?=[\\s?。，!-\/:-@[-\`{-~]|$)`, 'u');

	return { inlineRule, blockRule };
}

const { inlineRule, blockRule } = generateRegexRules(DELIMITER_LIST);

export default function (options = {}) {
	return {
		extensions: [inlineKatex(options), blockKatex(options)]
	};
}

function katexStart(src, displayMode: boolean) {
	let ruleReg = displayMode ? blockRule : inlineRule;

	let indexSrc = src;

	while (indexSrc) {
		let index = -1;
		let startIndex = -1;
		let startDelimiter = '';
		let endDelimiter = '';
		for (let delimiter of DELIMITER_LIST) {
			if (delimiter.display !== displayMode) {
				continue;
			}

			startIndex = indexSrc.indexOf(delimiter.left);
			if (startIndex === -1) {
				continue;
			}

			index = startIndex;
			startDelimiter = delimiter.left;
			endDelimiter = delimiter.right;
		}

		if (index === -1) {
			return;
		}

		// Check if the delimiter is preceded by a special character.
		// If it does, then it's potentially a math formula.
		const f = index === 0 || indexSrc.charAt(index - 1).match(/[\s?。，!-\/:-@[-`{-~]/);
		if (f) {
			const possibleKatex = indexSrc.substring(index);

			if (possibleKatex.match(ruleReg)) {
				return index;
			}
		}

		indexSrc = indexSrc.substring(index + startDelimiter.length).replace(endDelimiter, '');
	}
}

function katexTokenizer(src, tokens, displayMode: boolean) {
	let ruleReg = displayMode ? blockRule : inlineRule;
	let type = displayMode ? 'blockKatex' : 'inlineKatex';

	const match = src.match(ruleReg);

	if (match) {
		const text = match
			.slice(2)
			.filter((item) => item)
			.find((item) => item.trim());

		return {
			type,
			raw: match[0],
			text: text,
			displayMode
		};
	}
}

/**
 * Creates a plugin for inline KaTeX rendering.
 *
 * This function generates an object that contains methods for handling
 * inline KaTeX expressions within a markdown parser. It provides the
 * necessary hooks to identify, tokenize, and render inline math expressions
 * using KaTeX.
 *
 * @param {Object} options - Configuration options for the plugin.
 * @returns {Object} An object representing the inline KaTeX plugin with
 *                  the following properties:
 *                  - name: The name of the plugin.
 *                  - level: The level of parsing (inline).
 *                  - start: A function that identifies the start of an
 *                           inline KaTeX expression in the source text.
 *                  - tokenizer: A function that tokenizes the inline
 *                               KaTeX expression from the source text.
 *                  - renderer: A function that renders the tokenized
 *                             inline KaTeX expression into HTML.
 *
 * @example
 * const katexPlugin = inlineKatex({ /* options */
function inlineKatex(options) {
	return {
		name: 'inlineKatex',
		level: 'inline',
		start(src) {
			return katexStart(src, false);
		},
		tokenizer(src, tokens) {
			return katexTokenizer(src, tokens, false);
		},
		renderer(token) {
			return `${token?.text ?? ''}`;
		}
	};
}

/**
 * Creates a block-level Katex renderer for parsing and rendering mathematical expressions.
 *
 * @param {Object} options - Configuration options for the blockKatex renderer.
 * @returns {Object} An object representing the blockKatex renderer with properties and methods for processing.
 * @property {string} name - The name of the renderer.
 * @property {string} level - The level of the renderer, which is 'block' in this case.
 * @property {function} start - A function that determines the starting point of the block in the source text.
 * @param {string} src - The source text to search for the start of the block.
 * @returns {number|null} The index of the start position or null if not found.
 * @property {function} tokenizer - A function that tokenizes the source text into manageable pieces.
 * @param {string} src - The source text to tokenize.
 * @param {Array} tokens - An array of existing tokens to append to.
 * @returns {Array} An array of tokens generated from the source text.
 * @property {function} renderer - A function that renders a token into its final output format.
 * @param {Object} token - The token to be rendered.
 * @returns {string} The rendered output as a string.
 *
 * @example
 * const katexRenderer = blockKatex({ /* options */
function blockKatex(options) {
	return {
		name: 'blockKatex',
		level: 'block',
		start(src) {
			return katexStart(src, true);
		},
		tokenizer(src, tokens) {
			return katexTokenizer(src, tokens, true);
		},
		renderer(token) {
			return `${token?.text ?? ''}`;
		}
	};
}
