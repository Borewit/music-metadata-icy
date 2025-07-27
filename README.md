[![Node.js CI](https://github.com/Borewit/music-metadata-icy/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/Borewit/music-metadata-icy/actions/workflows/nodejs-ci.yml)
[![NPM version](https://img.shields.io/npm/v/@music-metadata%2Ficy.svg)](https://npmjs.org/package/@music-metadata/icy)
[![npm downloads](http://img.shields.io/npm/dm/@music-metadata%2Ficy.svg)](https://npmcharts.com/compare/@music-metadata%2Ficy?start=365)

# @music-metadata/icy

Decode [ICY metadata](https://en.wikipedia.org/wiki/SHOUTcast#Metadata) (used by Icecast and Shoutcast) from audio streams, commonly used in internet radio.

This module extracts ICY metadata (e.g., `StreamTitle`) from HTTP responses while passing through clean audio chunks for playback or further processing.

> ✅ **Lightweight** • **Fast** • **Web & Node-compatible** • Built on [`strtok3`](https://github.com/Borewit/strtok3)

---

## 🚀 Installation

```bash
npm install @music-metadata/icy
```

Or with Yarn:

```bash
yarn add @music-metadata/icy
```

---

## Demo

* [ICY Radio Stream Player](https://github.com/Borewit/icy-radio-stream-player)

---

## 📦 Usage

```ts
import { parseIcyResponse } from '@music-metadata/icy';

const response = await fetch('https://example.com/radio-stream', {
  headers: {
    'Icy-MetaData': '1'
  }
});

const audioStream = parseIcyResponse(response, ({ metadata }) => {
  const title = metadata.StreamTitle;
  if (title) {
    console.log('Now Playing:', title);
  }
});

// You can now pipe `audioStream` to a decoder or audio player.
```

---

## 🧠 API

### `parseIcyResponse(response, handler): ReadableStream<Uint8Array>`

Process a fetch-compatible HTTP response and extract ICY metadata on the fly.

#### Parameters

* `response: Response`
  A standard Fetch API [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) object with streaming body.
* `handler: (update: MetadataUpdate) => void`
  A callback triggered when new ICY metadata is available.

#### Returns

* `ReadableStream<Uint8Array>`
  A web-compatible readable stream containing **only the audio payload**, excluding metadata.

#### Example

```ts
{
  metadata: {
    StreamTitle: 'Cool Song',
    StreamUrl: 'https://example.com',
    ...
  },
  stats: {
    totalBytesRead: 20480,
    audioBytesRead: 19200,
    icyBytesRead: 1280
  }
}
```


---

### `decodeIcyStreamChunks(stream, metaInt, handler): ReadableStream<Uint8Array>`

Lower-level function to extract ICY metadata from a `ReadableStream` where the metadata interval is already known.

#### Parameters

* `stream: ReadableStream<Uint8Array>` or Node's `ReadableStream`
* `metaInt: number` – The icy metadata interval in bytes.
* `handler: (update: MetadataUpdate) => void` – Metadata callback, same as above.

#### Returns

* `ReadableStream<Uint8Array>` – Cleaned stream without metadata blocks.

Use this method if you already know the `icy-metaint` (e.g., from headers or external configuration).

---

## 🧺 ICY Metadata Parsing

ICY metadata is parsed from raw string format:

```ts
"StreamTitle='song';StreamUrl='url';"
```

Parsed result:

```ts
{
  StreamTitle: 'song',
  StreamUrl: 'url'
}
```

Internally handled by:

```ts
function parseRawIcyMetadata(raw: string): Map<string, string>
```

---

## 📜 Types

### `type IcyMetadata`

```ts
type IcyMetadata = {
  StreamTitle?: string;
  StreamUrl?: string;
  icyName?: string;
  icyGenre?: string;
  icyUrl?: string;
  bitrate?: string;
  contentType?: string;
  [key: string]: string | undefined;
}
```

### `type MetadataUpdate`

```ts
type MetadataUpdate = {
  metadata: IcyMetadata;
  stats: {
    totalBytesRead: number;
    audioBytesRead: number;
    icyBytesRead: number;
  };
};
```

---

## 🧱 Internals

If `Icy-Metaint` is not provided by the server, the module attempts to **auto-detect** the metadata interval by scanning the stream for known ICY patterns such as `"StreamTitle="`.

---

## 🧭 How It Works

The following diagram shows how `@music-metadata/icy` fits into a web-based ICY audio streaming pipeline, parsing interleaved metadata while passing clean audio through to playback:

```mermaid
graph TD
  %% Node Styles
  style A fill:#bbf,stroke:#333,stroke-width:2px
  style B fill:#ddf,stroke:#333,stroke-width:2px
  style C fill:#afa,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
  style D fill:#ffe4b3,stroke:#333,stroke-width:2px
  style E fill:#fcc,stroke:#333,stroke-width:2px,stroke-dasharray: 3 3
  style F fill:#fcf,stroke:#333,stroke-width:2px
  style G fill:#cff,stroke:#333,stroke-width:2px,stroke-dasharray: 2 4

  %% Nodes
  A["🎧 ICY Web Stream<br/>(Icecast via Fetch)"]
  B["🔀 Fetch with<br/>ICY-MetaData Header"]
  C["🧩 @music-metadata/icy<br/>(ICY Parser)"]
  D["🔁 Decoded Audio Stream"]
  E["🎵 HTML5 Audio<br/>&lt;audio&gt; Element"]
  F["🛰️ ICY Metadata Events"]
  G["🖥️ Metadata Display<br/>in React UI"]

  %% Flow
  A --> B
  B -->|ICY Interleaved Audio| C
  C -->|Audio Stream| D
  D --> E
  C -->|Metadata Events| F
  F -->|Track Info etc.| G
```
---

## 📄 License

MIT — see [LICENSE.txt](LICENSE.txt) for full text.
