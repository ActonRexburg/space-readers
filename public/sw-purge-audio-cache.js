/**
 * Imported by the generated Workbox SW (see vite.config.ts importScripts).
 *
 * cleanupOutdatedCaches only drops Workbox PRECACHE buckets. It does not
 * delete runtime caches named audio-cache / audio-cache-v2 /
 * sr-*-audio-cache-v2. Those CacheFirst entries are the suspected silent
 * voice-mp3 bug: Chrome Range requests + GitHub Pages 206 (or a stored
 * 200 served back to a Range GET) produced empty playback while play()
 * still resolved.
 *
 * Voice mp3s are now NetworkOnly (same as video). On activate, wipe any
 * leftover audio-cache* so a poisoned entry can never be served again.
 */
/* eslint-disable no-restricted-globals */
async function srPurgeAudioCaches() {
  const keys = await caches.keys();
  const doomed = keys.filter((key) => /audio-cache/i.test(key));
  await Promise.all(doomed.map((key) => caches.delete(key)));
  if (doomed.length) {
    console.log('[sr-sw] purged audio-cache*', doomed);
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(srPurgeAudioCaches());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SR_PURGE_AUDIO_CACHE') {
    event.waitUntil(srPurgeAudioCaches());
  }
});
