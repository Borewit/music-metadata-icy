import * as token from 'token-types';
import { fromWebStream } from 'strtok3';
import initDebug from 'debug';

import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';

const debug = initDebug('music-metadata:icy');

function cleanString(str: string): string {
  return str.replace(/\0+$/, '').trim();
}

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

export type IcyMetadataHandler = (update: Map<string, string>) => void;

/**
 * Process an Icecast-compatible HTTP response, extracting and filtering ICY metadata.
 */
export function parseIcyResponse(
  response: Response,
  handler: IcyMetadataHandler
): ReadableStream<Uint8Array> {
  const metaIntHeader = response.headers.get('icy-metaint');
  if (!metaIntHeader) {
    throw new Error("Missing 'icy-metaint' header — cannot parse ICY metadata.");
  }

  const metaInt = Number.parseInt(metaIntHeader, 10);
  if (!Number.isFinite(metaInt) || metaInt <= 0) {
    throw new Error(`Invalid 'icy-metaint' value: "${metaIntHeader}".`);
  }

  if (!response.body) {
    throw new Error('Response body is missing — cannot stream audio.');
  }

  return decodeIcyStreamChunks(response.body, metaInt, handler);
}

/**
 * Decode and filter out ICY metadata blocks from the stream.
 */
export function decodeIcyStreamChunks(
  icyStream: ReadableStream | NodeWebReadableStream,
  metadataInterval: number,
  onMetadata: IcyMetadataHandler
): ReadableStream<Uint8Array> {
  debug('Starting ICY stream processing');

  const tokenizer = fromWebStream(icyStream);
  const preferredChunkSize = Math.min(metadataInterval, 8192);

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          let remainingAudio = metadataInterval;

          while (remainingAudio > 0) {
            const chunkSize = Math.min(remainingAudio, preferredChunkSize);
            const buffer = new Uint8Array(chunkSize);
            const bytesRead = await tokenizer.readBuffer(buffer);

            if (bytesRead <= 0) {
              debug('Stream ended during audio block read');
              controller.close();
              return;
            }

            controller.enqueue(buffer.subarray(0, bytesRead));
            remainingAudio -= bytesRead;
          }

          const lengthByte = await tokenizer.readToken(token.UINT8);
          const metadataLength = lengthByte * 16;

          if (metadataLength > 0) {
            try {
              const rawMetadata = await tokenizer.readToken(
                new token.StringType(metadataLength, 'utf-8')
              );
              const metadata = parseRawIcyMetadata(rawMetadata);
              debug(`Parsed ICY metadata: ${[...metadata.entries()].map(([k, v]) => `${k}='${v}'`).join('; ')}`);
              onMetadata(metadata);
            } catch (err) {
              debug(`Failed to parse metadata: ${(err as Error)?.message ?? err}`);
            }
          } else {
            debug('Empty metadata block');
          }
        }
      } catch (err) {
        debug(`Stream closed due to error or EOF: ${(err as Error)?.message ?? err}`);
        controller.close();
      }
    }
  });
}
