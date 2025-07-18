import { decodeIcyStreamChunks, parseIcyResponse } from '../lib/index.js';
import { assert } from 'chai';

/**
 * Reference Audio Streams
 * https://www.radiomast.io/reference-streams
 */
const radioMast = {
  https: {
    mp3: {
      _128kb: 'https://audio-edge-kef8b.ams.s.radiomast.io/ref-128k-mp3-stereo',
      _128kb_preroll: 'https://audio-edge-kef8b.ams.s.radiomast.io/ref-128k-mp3-stereo-preroll'
    },
    ogg: {
      flac: 'https://streams.radiomast.io/ref-lossless-ogg-flac-stereo'
    }
  }
};

async function fetchIcyStream(url) {
  return fetch(url, {
    headers: new Headers({
      'Icy-MetaData': '1'
    })
  });
}

describe('@music-metadata/icy', function () {
  this.timeout(15000); // Allow enough time for live stream

  it('should fetch ICY metadata from Ogg/FLAC stream and receive audio', async () => {
    const response = await fetchIcyStream(radioMast.https.ogg.flac);

    const receivedMetadata = [];
    let receivedAudioBytes = 0;

    const audioStream = parseIcyResponse(response, metadata => {
      console.log('ICY metadata:', Object.fromEntries(metadata));
      receivedMetadata.push(metadata);
    });

    const reader = audioStream.getReader();
    let chunkCount = 0;

    try {
      while (chunkCount < 100) {
        const { value, done } = await reader.read();
        if (done) break;

        if (value) {
          receivedAudioBytes += value.length;
          chunkCount++;
        }

        if (receivedMetadata.length > 0) break;
      }
    } finally {
      await reader.cancel(); // Clean up stream
    }

    assert.isAbove(receivedAudioBytes, 0, 'Should receive some audio data');
    assert.isNotEmpty(receivedMetadata, 'Should receive at least one ICY metadata update');

    const firstMeta = receivedMetadata[0];
    assert.instanceOf(firstMeta, Map, 'Metadata should be a Map');
    assert.isTrue(firstMeta.has('StreamTitle'), 'Metadata should include StreamTitle');

    const title = firstMeta.get('StreamTitle');
    assert.isString(title, 'StreamTitle should be a string');
    assert.match(title, /.+/, 'StreamTitle should not be empty');
  });
});
