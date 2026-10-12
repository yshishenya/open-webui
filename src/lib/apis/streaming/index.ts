import { EventSourceParserStream } from 'eventsource-parser/stream';
import type { ParsedEvent } from 'eventsource-parser';

type TextStreamUpdate = {
	done: boolean;
	value: string;
	sources?: unknown;
	selectedModelId?: unknown;
	error?: unknown;
	usage?: unknown;
};

// createOpenAITextStream takes a responseBody with a SSE response,
// and returns an async generator that emits delta updates with large deltas chunked into random sized chunks
export async function createOpenAITextStream(
	responseBody: ReadableStream<Uint8Array<ArrayBuffer>>,
	splitLargeDeltas: boolean
): Promise<AsyncGenerator<TextStreamUpdate>> {
	const eventStream = responseBody
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(new EventSourceParserStream())
		.getReader();
	let iterator = openAIStreamToIterator(eventStream);
	if (splitLargeDeltas) {
		iterator = streamLargeDeltasAsRandomChunks(iterator);
	}
	return iterator;
}

async function* openAIStreamToIterator(
	reader: ReadableStreamDefaultReader<ParsedEvent>
): AsyncGenerator<TextStreamUpdate> {
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) {
				yield { done: true, value: '' };
				break;
			}
			if (!value) {
				continue;
			}
			const data = value.data;
			if (data.startsWith('[DONE]')) {
				yield { done: true, value: '' };
				break;
			}

			try {
				const parsed: unknown = JSON.parse(data);
				if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
				const parsedData = parsed as Record<string, unknown>;

				if (parsedData.error) {
					yield { done: true, value: '', error: parsedData.error };
					break;
				}

				if (parsedData.sources) {
					yield { done: false, value: '', sources: parsedData.sources };
					continue;
				}

				if (parsedData.selected_model_id) {
					yield { done: false, value: '', selectedModelId: parsedData.selected_model_id };
					continue;
				}

				if (parsedData.usage) {
					yield { done: false, value: '', usage: parsedData.usage };
					continue;
				}

				const choice = Array.isArray(parsedData.choices) ? parsedData.choices[0] : undefined;
				const content: unknown = choice?.delta?.content;
				yield { done: false, value: typeof content === 'string' ? content : '' };
			} catch {
				console.warn('Invalid response stream event');
			}
		}
	} finally {
		try {
			await reader.cancel();
		} catch {
			console.warn('Unable to cancel response stream');
		}
		reader.releaseLock();
	}
}

// streamLargeDeltasAsRandomChunks will chunk large deltas (length > 5) into random sized chunks between 1-3 characters
// This is to simulate a more fluid streaming, even though some providers may send large chunks of text at once
async function* streamLargeDeltasAsRandomChunks(
	iterator: AsyncGenerator<TextStreamUpdate>
): AsyncGenerator<TextStreamUpdate> {
	for await (const textStreamUpdate of iterator) {
		if (textStreamUpdate.done) {
			yield textStreamUpdate;
			return;
		}

		if (textStreamUpdate.error) {
			yield textStreamUpdate;
			continue;
		}
		if (textStreamUpdate.sources) {
			yield textStreamUpdate;
			continue;
		}
		if (textStreamUpdate.selectedModelId) {
			yield textStreamUpdate;
			continue;
		}
		if (textStreamUpdate.usage) {
			yield textStreamUpdate;
			continue;
		}

		let content = textStreamUpdate.value;
		if (content.length < 5) {
			yield { done: false, value: content };
			continue;
		}
		while (content != '') {
			const chunkSize = Math.min(Math.floor(Math.random() * 3) + 1, content.length);
			const chunk = content.slice(0, chunkSize);
			yield { done: false, value: chunk };
			// Do not sleep if the tab is hidden
			// Timers are throttled to 1s in hidden tabs
			if (document?.visibilityState !== 'hidden') {
				await sleep(5);
			}
			content = content.slice(chunkSize);
		}
	}
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
