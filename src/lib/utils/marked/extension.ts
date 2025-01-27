// Helper function to find matching closing tag
/**
 * Finds the index of the matching closing tag for a given opening tag in a string.
 *
 * This function searches through the provided source string to locate the corresponding
 * closing tag for the specified opening tag. It accounts for nested tags by maintaining
 * a depth counter. If a matching closing tag is found, the function returns the index
 * immediately following the closing tag; otherwise, it returns -1.
 *
 * @param {string} src - The source string to search within.
 * @param {string} openTag - The opening tag to match.
 * @param {string} closeTag - The closing tag to match.
 * @returns {number} The index immediately after the matching closing tag, or -1 if no match is found.
 *
 * @example
 * const index = findMatchingClosingTag('<div><span></span></div>', '<div>', '</div>');
 * console.log(index); // Outputs: 20
 *
 * @throws {Error} Throws an error if the input parameters are invalid (e.g., empty strings).
 */
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
/**
 * Parses a string containing HTML-like attributes and returns an object
 * mapping attribute names to their corresponding values.
 *
 * This function uses a regular expression to extract attributes in the
 * format `name="value"` from the provided tag string. It supports multiple
 * attributes and returns them as key-value pairs in an object.
 *
 * @param {string} tag - The string containing the attributes to parse.
 * @returns {{ [key: string]: string }} An object where each key is an
 * attribute name and each value is the corresponding attribute value.
 *
 * @example
 * const attributes = parseAttributes('data-id="123" data-name="example"');
 * console.log(attributes); // { data-id: "123", data-name: "example" }
 *
 * @throws {Error} Throws an error if the input string is not valid.
 */
function parseAttributes(tag: string): { [key: string]: string } {
	const attributes: { [key: string]: string } = {};
	const attrRegex = /(\w+)="(.*?)"/g;
	let match;
	while ((match = attrRegex.exec(tag)) !== null) {
		attributes[match[1]] = match[2];
	}
	return attributes;
}

/**
 * Tokenizes a <details> HTML element from the provided source string.
 * This function extracts the summary, content, and attributes from the <details> tag.
 *
 * @param {string} src - The source string containing the <details> element to be tokenized.
 * @returns {Object|undefined} An object containing the following properties if a <details> tag is found:
 *   - type: A string indicating the type of the tokenized element (always 'details').
 *   - raw: The raw string of the entire <details> element including its content.
 *   - summary: The summary text extracted from the <summary> tag within <details>.
 *   - text: The remaining content inside the <details> tag after the summary.
 *   - attributes: An object representing the attributes found in the <details> tag.
 *
 * @example
 * const result = detailsTokenizer('<details><summary>Click me</summary>Some content</details>');
 * console.log(result);
 * // Output:
 * // {
 * //   type: 'details',
 * //   raw: '<details><summary>Click me</summary>Some content</details>',
 * //   summary: 'Click me',
 * //   text: 'Some content',
 * //   attributes: {} // Assuming no attributes are present
 * // }
 *
 * @throws {Error} Throws an error if the <details> tag is not properly closed.
 */
function detailsTokenizer(src: string) {
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

		return {
			type: 'details',
			raw: fullMatch,
			summary: summary,
			text: content,
			attributes: attributes // Include extracted attributes from <details>
		};
	}
}

/**
 * Checks if the provided source string starts with the `<details>` tag.
 *
 * This function examines the input string and returns the index of the start of the `<details>` tag if it is present at the beginning of the string.
 * If the `<details>` tag is not found, it returns -1.
 *
 * @param {string} src - The source string to be checked for the `<details>` tag.
 * @returns {number} The index of the `<details>` tag if found, otherwise -1.
 *
 * @example
 * const result = detailsStart('<details>Some content</details>');
 * console.log(result); // Output: 0
 *
 * const result2 = detailsStart('Some other content');
 * console.log(result2); // Output: -1
 */
function detailsStart(src: string) {
	return src.match(/^<details>/) ? 0 : -1;
}

/**
 * Renders a details HTML element based on the provided token object.
 *
 * This function constructs a `<details>` element, optionally including a `<summary>`
 * if the token contains a summary. It also adds any attributes specified in the token's
 * attributes object as HTML attributes to the `<details>` element.
 *
 * @param {Object} token - The token object containing details for rendering.
 * @param {Object} [token.attributes] - An optional object containing attributes to be added to the details element.
 * @param {string} [token.summary] - An optional summary text to be displayed in the summary element.
 * @param {string} token.text - The main content to be displayed within the details element.
 *
 * @returns {string} The rendered HTML string for the details element.
 *
 * @example
 * const token = {
 *   attributes: { open: true, class: 'custom-class' },
 *   summary: 'Click to expand',
 *   text: 'This is the detailed content.'
 * };
 * const html = detailsRenderer(token);
 * // html will be:
 * // <details open class="custom-class">
 * //   <summary>Click to expand</summary>
 * //   This is the detailed content.
 * // </details>
 */
function detailsRenderer(token: any) {
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
/**
 * Creates a configuration object for the 'details' extension.
 * This extension is designed to enhance the rendering of details blocks
 * within a specific context, such as a markdown parser or a custom renderer.
 *
 * @returns {Object} An object containing the configuration for the 'details' extension.
 * @returns {string} return.name - The name of the extension.
 * @returns {string} return.level - The level of the extension, indicating its hierarchy.
 * @returns {Function} return.start - A function that handles the starting logic for the extension.
 * @returns {Function} return.tokenizer - A function that tokenizes the input for the extension.
 * @returns {Function} return.renderer - A function that renders the output of the extension.
 *
 * @example
 * const detailsConfig = detailsExtension();
 * console.log(detailsConfig.name); // Output: 'details'
 *
 * @throws {Error} Throws an error if the configuration cannot be created.
 */
function detailsExtension() {
	return {
		name: 'details',
		level: 'block',
		start: detailsStart,
		tokenizer: detailsTokenizer,
		renderer: detailsRenderer
	};
}

export default function (options = {}) {
	return {
		extensions: [detailsExtension(options)]
	};
}
