import * as token from 'token-types';
import {fromWebStream, type ITokenizer} from 'strtok3';
import initDebug from 'debug';

import type {ReadableStream as NodeWebReadableStream} from 'node:stream/web';

const debug = initDebug('music-metadata-icy');

function cleanString(str: string): string {
	return str.replace(/\0+$/, '').trim();
}

type IcyMetadata = {
	StreamTitle?: string;
	StreamUrl?: string;
	icyName?: string;
	icyGenre?: string;
	icyUrl?: string;
	bitrate?: string;
	contentType?: string;
	[key: string]: string | undefined; // fallback for unknown/future keys
};

export type StreamStats = {
	totalBytesRead: number;
	audioBytesRead: number;
	icyBytesRead: number;
};

export type MetadataUpdate = {
	metadata: IcyMetadata;
	stats: StreamStats;
};

/**
 * Parses raw ICY metadata into a key-value map.
 *
 * @param raw - Raw ICY metadata string, e.g. "StreamTitle='song';StreamUrl='url';"
 * @returns Map of metadata keys and values
 */
function parseRawIcyMetadata(raw: string): Map<string, string> {
	const metadata = new Map<string, string>();
	const regex = /([a-zA-Z0-9]+)='(.*?)';/g;

	for (const match of raw.matchAll(regex)) {
		const key = cleanString(match[1]);
		const value = cleanString(match[2]);
		metadata.set(key, value);
	}

	return metadata;
}

export type IcyMetadataHandler = (update: MetadataUpdate) => void;

/**
 * Process an Icecast-compatible HTTP response, extracting and filtering ICY metadata.
 */
export function parseIcyResponse(
	response: Response,
	handler: IcyMetadataHandler
): ReadableStream<Uint8Array> {

	const metaIntHeader = response.headers.get('Icy-Metaint');

	const metaInt = metaIntHeader ? Number.parseInt(metaIntHeader, 10) : 0;
	if (metaInt === 0) {
		debug(`No HTTP header "Icy-Metaint" found. `);
	} else {
		debug(`Received HTTP header "Icy-Metaint" header =${metaInt} bytes`);
	}

	if (!response.body) {
		throw new Error('Response body is missing — cannot stream audio.');
	}

	return decodeIcyStreamChunks(response.body, metaInt, handler);
}

async function detectMetaInt(tokenizer: ITokenizer): Promise<number> {
	debug('Trying to detect ICY metaInt from content...');
	const detectionBufferSize = 64 * 1024;
	const peekBuffer = new Uint8Array(detectionBufferSize);
	const bytesRead = await tokenizer.peekBuffer(peekBuffer);
	const needle = new TextEncoder().encode('StreamTitle=');

	if (bytesRead < detectionBufferSize) {
		debug(`Only read ${bytesRead} bytes for detection — may be truncated.`);
	}

	// Search for the "StreamTitle=" pattern in the peek buffer
	let foundAt = -1;
	for (let i = 0; i < bytesRead - needle.length; i++) {
		let match = true;
		for (let j = 0; j < needle.length; j++) {
			if (peekBuffer[i + j] !== needle[j]) {
				match = false;
				break;
			}
		}
		if (match) {
			foundAt = i;
			break;
		}
	}

	if (foundAt !== -1) {
		debug(`Guessed icy-metaint as ${foundAt - 1}`);
		return foundAt - 1;
	}
	debug('StreamTitle not found — likely not an ICY metadata stream.');
	return 0;
}

export function decodeIcyStreamChunks(
	icyStream: ReadableStream | NodeWebReadableStream,
	metadataInterval: number,
	onMetadata: IcyMetadataHandler
): ReadableStream<Uint8Array> {
	debug('Starting ICY stream processing');

	const stats = {
		audioBytesRead: 0,
		icyBytesRead: 0
	};

	const maxChunkSize = 32 * 1024;
	const tokenizer = fromWebStream(icyStream);
	const chunkSize = metadataInterval > 0 ? Math.min(metadataInterval, maxChunkSize) : maxChunkSize;
	const buffer = new Uint8Array(chunkSize);

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				if (metadataInterval === 0) {
					metadataInterval = await detectMetaInt(tokenizer);
				}

				while (true) {
					let remainingAudio = metadataInterval;

					while (remainingAudio > 0 || metadataInterval === 0) {
						const bytesRead = await tokenizer.readBuffer(buffer);
						stats.audioBytesRead += bytesRead;

						if (bytesRead <= 0) {
							debug('Stream ended during audio block read');
							controller.close();
							return;
						}

						controller.enqueue(buffer.slice(0, bytesRead));
						if (metadataInterval) {
							remainingAudio -= bytesRead;
						}
					}

					const lengthByte = await tokenizer.readToken(token.UINT8);
					const metadataLength = lengthByte * 16;
					stats.icyBytesRead += 1 + metadataLength;

					let metadata: IcyMetadata = {};
					if (metadataLength > 0) {
						try {
							const rawMetadata = await tokenizer.readToken(
								new token.StringType(metadataLength, 'utf-8')
							);
							const metadataMap = parseRawIcyMetadata(rawMetadata);
							for (const [key, value] of metadataMap.entries()) {
								debug(`Rx ICY metadata tag: ${key}="${value}"`);
							}
							metadata = Object.fromEntries(metadataMap);
						} catch (err) {
							debug(`Failed to parse metadata: ${(err as Error)?.message ?? err}`);
						}
					} else {
						debug('Rx ICY metadata: empty');
					}
					onMetadata({
						metadata: metadata,
						stats: {
							totalBytesRead: tokenizer.position,
							audioBytesRead: stats.audioBytesRead,
							icyBytesRead: stats.icyBytesRead
						}
					});
				}
			} catch (err) {
				debug(`Stream closed due to error or EOF: ${(err as Error)?.message ?? err}`);
				controller.close();
			}
		},
		cancel(reason) {
			debug(`Stream cancelled: ${reason}`);
			try {
				return tokenizer.close?.()
					.then(() => icyStream.cancel());
			} catch (err) {
				debug(`Error during tokenizer cleanup: ${(err as Error)?.message ?? err}`);
			}
		}
	});
}
