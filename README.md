[![Node.js CI](https://github.com/Borewit/music-metadata-icy/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/Borewit/music-metadata-icy/actions/workflows/nodejs-ci.yml)
[![NPM version](https://img.shields.io/npm/v/@music-metadata%2Ficy.svg)](https://npmjs.org/package/@music-metadata/icy)
[![npm downloads](http://img.shields.io/npm/dm/@music-metadata%2Ficy.svg)](https://npmcharts.com/compare/@music-metadata%2Ficy?start=365)

# @music-metadata/icy

Decode [ICY metadata](https://en.wikipedia.org/wiki/SHOUTcast#Metadata) (used by Icecast and Shoutcast) from streaming audio responses.

This module extracts metadata (e.g. `StreamTitle`) from HTTP streams (like radio stations) while passing through clean audio chunks suitable for playback or further decoding.

> ✅ Lightweight • Fast • Web & Node-compatible • Built on [`strtok3`](https://github.com/Borewit/strtok3)

---

## 🚀 Installation

```bash
npm install @music-metadata/icy
```
Or with Yarn:

```bash
yarn add @music-metadata/icy
```
## 📦 Usage

```js
import { parseIcyResponse } from '@music-metadata/icy';

const response = await fetch('https://example.com/radio-stream', {
  headers: {
    'Icy-MetaData': '1'
  }
});

const stream = parseIcyResponse(response, metadata => {
  const title = metadata.get('StreamTitle');
  if (title) {
    console.log('Now Playing:', title);
  }
});
```

## 🧠 API

```ts
parseIcyResponse(response: Response, handler: (metadata: string) => void): ReadableStream<Uint8Array>
```
Parses an [HTTP Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) from an Icecast/Shoutcast stream, extracting ICY metadata and returning a filtered stream containing only audio data.

#### Parameters:
response: A fetch-like [HTTP Response object](https://developer.mozilla.org/en-US/docs/Web/API/Response)

handler: A callback invoked when ICY metadata is received (as raw string)

#### Returns:
A `ReadableStream<Uint8Array>` without metadata (pure audio)

```ts
decodeIcyStreamChunks(stream: ReadableStream, metaInt: number, handler: (metadata: string) => void): ReadableStream<Uint8Array>
```
Lower-level function for manually decoding a stream with a known icy-metaint interval.

## Licence

This project is licensed under the [MIT License](LICENSE.txt). Feel free to use, modify, and distribute as needed.
