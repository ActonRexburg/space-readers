#!/usr/bin/env node
/**
 * Pre-generate Zib + Mission Control voice clips with edge-tts.
 *
 *   zib     en-US-BrianNeural  pitch +18Hz  rate +6%  light echo
 *   control en-US-AndrewNeural subtle radio/comm EQ (UI + briefing only)
 *   story   en-US-AndrewNeural no EQ (Say Word / Hear It only — not sentences)
 *
 * Run: npm run gen:voice
 * Files land in public/audio/voice/{hash}.mp3 keyed by voice|normalized-text
 * in manifest.json. speak() looks up that key at runtime.
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access, unlink, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { STORIES } from '../src/data/stories.ts';
import { MISSIONS } from '../src/data/missions.ts';
import { INTEREST_OPTIONS } from '../src/data/interests.ts';
import { staticCatalog, storyCompleteLine } from '../src/data/voiceLines.ts';
import {
  stripLetterNames,
  voiceLookupKey,
  normalizeVoiceText,
} from '../src/utils/voice.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'audio', 'voice');
const PY = join(ROOT, 'scripts', '_edge_tts_batch.py');
const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry-run');
const PRUNE_ONLY = process.argv.includes('--prune-only');

const VOICES = {
  zib: {
    engine: 'en-US-BrianNeural',
    rate: '+6%',
    pitch: '+18Hz',
    // Light echo so Zib matches the existing clip treatment.
    fx: 'aecho=0.8:0.9:55:0.28',
  },
  control: {
    engine: 'en-US-AndrewNeural',
    rate: '+0%',
    pitch: '+0Hz',
    // Very subtle radio/comm EQ — UI and briefing only, never story/Say Word.
    fx: 'highpass=f=280,lowpass=f=3600,equalizer=f=1600:t=q:w=0.7:g=1.2',
  },
  story: {
    engine: 'en-US-AndrewNeural',
    rate: '+0%',
    pitch: '+0Hz',
    fx: null,
  },
};

function hashName(key) {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function mapWordCharIndexes(original, words) {
  let searchFrom = 0;
  const lower = original.toLowerCase();
  return words.map((w) => {
    const needle = String(w.text || '').toLowerCase();
    if (!needle) {
      return { text: w.text || '', offsetMs: w.offsetMs, charIndex: searchFrom };
    }
    const at = lower.indexOf(needle, searchFrom);
    const charIndex = at >= 0 ? at : searchFrom;
    if (at >= 0) searchFrom = at + needle.length;
    return { text: w.text || '', offsetMs: w.offsetMs, charIndex };
  });
}

function addLine(bucket, kind, text) {
  const normalized = normalizeVoiceText(text);
  if (!normalized) return;
  const key = voiceLookupKey(kind, normalized);
  if (!bucket.has(key)) {
    bucket.set(key, { kind, text: normalized });
  }
}

function collectJobs() {
  const bucket = new Map();

  for (const line of staticCatalog()) {
    addLine(bucket, line.kind, line.text);
  }

  for (const mission of MISSIONS) {
    addLine(bucket, 'control', mission.title);
    addLine(bucket, 'control', mission.description);
    addLine(bucket, 'control', mission.briefing);
    addLine(bucket, 'control', mission.completionMessage);
    addLine(bucket, 'control', `${mission.title}. ${mission.description}`);
    addLine(bucket, 'control', `${mission.title}. ${mission.briefing}`);
    for (const sentence of mission.briefing.split(/(?<=[.!?])\s+/)) {
      addLine(bucket, 'control', sentence);
    }
    for (const line of mission.alienDialogue) {
      addLine(bucket, 'zib', line);
    }
  }

  for (const story of STORIES) {
    addLine(bucket, 'control', story.title);
    if (story.storyContext) {
      addLine(bucket, 'control', story.storyContext);
      addLine(bucket, 'control', `${story.title}. ${story.storyContext}`);
    }
    addLine(bucket, 'control', storyCompleteLine(story.title));

    // Per-word Say Word / Hear It clips only. Whole-sentence story read-aloud
    // was removed so kids can't tap 🔊 instead of reading.
    for (const para of story.paragraphs) {
      for (const word of para.words) {
        const clean = word.word.replace(/[^a-zA-Z]/g, '');
        if (clean) addLine(bucket, 'story', clean);
      }
    }
  }

  for (const interest of INTEREST_OPTIONS) {
    addLine(bucket, 'control', interest.label);
  }

  return [...bucket.values()];
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

function maxVolumeDb(path) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      ['-hide_banner', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let err = '';
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', () => {
      const match = err.match(/max_volume:\s*([-\d.]+)/);
      resolve(match ? parseFloat(match[1]) : -99);
    });
  });
}

function runCapture(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err.trim()}`));
    });
  });
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function applyFxAndManifest(job, rawMp3, destMp3, metaPath) {
  const profile = VOICES[job.kind];
  // Fade-in only. `afade=t=out:d=0.04` WITHOUT st= starts the fade at t=0
  // and leaves the rest of the clip at gain 0 — that is how the live
  // catalog shipped as valid mp3s with duration but digital silence
  // (ffmpeg max_volume -91 dB). 🔊 then "played" and never fell back to TTS.
  const fadeIn = 'afade=t=in:st=0:d=0.02';
  const af = profile.fx ? `${profile.fx},${fadeIn}` : fadeIn;

  await runCapture('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', rawMp3,
    '-af', af,
    '-ar', '24000',
    '-ac', '1',
    '-b:a', '48k',
    destMp3,
  ]);

  // The live catalog was once committed as valid mp3s with duration but
  // digital silence (ffmpeg max_volume -91 dB). Reject those so 🔊 cannot
  // "succeed" while Brian hears nothing.
  const peakDb = await maxVolumeDb(destMp3);
  if (!(peakDb > -40)) {
    await unlink(destMp3).catch(() => {});
    throw new Error(`silent mp3 max_volume=${peakDb} dB`);
  }

  const meta = JSON.parse(await readFile(metaPath, 'utf8'));
  const words = mapWordCharIndexes(job.text, meta.words || []);
  let durationMs = words.length ? words[words.length - 1].offsetMs + 400 : 800;
  try {
    const probe = await runCapture('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', destMp3,
    ]);
    const seconds = parseFloat(probe);
    if (!Number.isNaN(seconds)) durationMs = Math.round(seconds * 1000);
  } catch {
    // keep estimate
  }

  await unlink(rawMp3).catch(() => {});
  await unlink(metaPath).catch(() => {});
  return { words, durationMs };
}

async function pruneUnused(jobs, clips) {
  const keepKeys = new Set(jobs.map((job) => voiceLookupKey(job.kind, job.text)));
  const keepFiles = new Set(['manifest.json']);
  const next = {};
  let pruned = 0;

  for (const [key, val] of Object.entries(clips)) {
    if (keepKeys.has(key) && val?.file) {
      next[key] = val;
      keepFiles.add(val.file);
    } else {
      pruned += 1;
      if (val?.file) {
        await unlink(join(OUT_DIR, val.file)).catch(() => {});
      }
    }
  }

  const names = await readdir(OUT_DIR);
  for (const name of names) {
    if (!name.endsWith('.mp3')) continue;
    if (keepFiles.has(name)) continue;
    await unlink(join(OUT_DIR, name)).catch(() => {});
    pruned += 1;
  }

  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({
    version: 1,
    voices: {
      zib: 'edge-tts en-US-BrianNeural, pitch +18Hz, rate +6%, light echo',
      control: 'edge-tts en-US-AndrewNeural, subtle radio EQ (UI/briefing)',
      story: 'edge-tts en-US-AndrewNeural, no EQ (Say Word / Hear It only)',
    },
    clips: next,
  }, null, 2));

  console.log(`Pruned unused clips=${pruned}; kept=${Object.keys(next).length}`);
  return next;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const jobs = collectJobs();
  console.log(`Collected ${jobs.length} unique clips`);

  if (DRY) {
    const counts = { zib: 0, control: 0, story: 0 };
    for (const job of jobs) counts[job.kind] += 1;
    console.log(counts);
    for (const job of jobs.slice(0, 20)) {
      console.log(`  [${job.kind}] ${job.text.slice(0, 80)}`);
    }
    return;
  }

  const manifestPath = join(OUT_DIR, 'manifest.json');
  let existing = { version: 1, clips: {} };
  if (await fileExists(manifestPath)) {
    try {
      existing = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch {
      existing = { version: 1, clips: {} };
    }
  }

  if (PRUNE_ONLY) {
    await pruneUnused(jobs, existing.clips || {});
    return;
  }

  const clips = { ...existing.clips };
  const pending = [];

  for (const job of jobs) {
    const key = voiceLookupKey(job.kind, job.text);
    const file = `${hashName(key)}.mp3`;
    const dest = join(OUT_DIR, file);
    if (!FORCE && clips[key] && await fileExists(dest)) continue;
    const id = hashName(key);
    pending.push({
      ...job,
      id,
      key,
      file,
      dest,
      raw: join(OUT_DIR, `${id}.raw.mp3`),
      meta: join(OUT_DIR, `${id}.meta.json`),
    });
  }

  console.log(`Need to synthesize ${pending.length} (already have ${jobs.length - pending.length})`);

  const CHUNK = 40;
  let built = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    const jobsFile = join(tmpdir(), `voice-jobs-${Date.now()}-${i}.json`);
    const pyJobs = chunk.map((job) => ({
      id: job.id,
      text: stripLetterNames(job.text) || job.text,
      voice: VOICES[job.kind].engine,
      rate: VOICES[job.kind].rate,
      pitch: VOICES[job.kind].pitch,
      out: job.raw,
      meta: job.meta,
    }));
    await writeFile(jobsFile, JSON.stringify(pyJobs));
    console.log(`TTS chunk ${i / CHUNK + 1}/${Math.ceil(pending.length / CHUNK)} (${chunk.length} clips)`);
    try {
      await run('python3', [PY, jobsFile]);
    } catch (err) {
      console.warn(`chunk finished with errors: ${err.message}`);
    }

    for (const job of chunk) {
      if (!(await fileExists(job.raw))) {
        failed += 1;
        console.error(`FAIL [${job.kind}] ${job.text.slice(0, 70)}`);
        continue;
      }
      try {
        const { words, durationMs } = await applyFxAndManifest(job, job.raw, job.dest, job.meta);
        clips[job.key] = { file: job.file, durationMs, words };
        built += 1;
      } catch (err) {
        failed += 1;
        console.error(`FX FAIL [${job.kind}] ${job.text.slice(0, 70)} — ${err.message}`);
      }
    }

    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      voices: {
        zib: 'edge-tts en-US-BrianNeural, pitch +18Hz, rate +6%, light echo',
        control: 'edge-tts en-US-AndrewNeural, subtle radio EQ (UI/briefing)',
        story: 'edge-tts en-US-AndrewNeural, no EQ (Say Word / Hear It only)',
      },
      clips,
    }, null, 2));
  }

  await pruneUnused(jobs, clips);
  console.log(`Done. built=${built} failed=${failed} catalog=${jobs.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
