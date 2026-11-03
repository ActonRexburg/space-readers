#!/usr/bin/env python3
"""Generate isolated phoneme clips with edge-tts (en-US-JennyNeural).

Edge TTS does not honor nested <phoneme> SSML, so we use:
- phonetic spellings that yield the sound, not the letter name (sss, shh, eh)
- short onset slices from carrier words for stop consonants (bat -> /b/, not "bee")
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import tempfile
from pathlib import Path

import edge_tts

VOICE = "en-US-JennyNeural"
RATE = "-10%"
OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "audio" / "phonemes"

# mode:
#   spelling — TTS the text, trim silence (good for vowels and continuants)
#   onset    — TTS carrier word, keep the first N ms (stop consonants)
#   nucleus  — TTS carrier word, skip skip_ms, keep duration_ms (short vowels)

PHONEMES: dict[str, dict] = {
    # Stretchable continuants
    "s": {"mode": "spelling", "text": "sss"},
    "z": {"mode": "spelling", "text": "zzz"},
    "f": {"mode": "spelling", "text": "fff"},
    "v": {"mode": "spelling", "text": "vvv"},
    "m": {"mode": "spelling", "text": "mmm"},
    "n": {"mode": "spelling", "text": "nnn"},
    "l": {"mode": "spelling", "text": "lll"},
    "r": {"mode": "spelling", "text": "rrr"},
    "sh": {"mode": "spelling", "text": "shh"},
    "th": {"mode": "spelling", "text": "thhh"},
    "ng": {"mode": "spelling", "text": "nggg"},
    "h": {"mode": "onset", "text": "hat", "ms": 90},
    "w": {"mode": "onset", "text": "wet", "ms": 100},
    "y": {"mode": "onset", "text": "yes", "ms": 90},
    "wh": {"mode": "onset", "text": "wet", "ms": 100},
    # Stop consonants: slice the burst from a real word so TTS cannot say "bee"/"ay"/"tee"
    "b": {"mode": "onset", "text": "bat", "ms": 80},
    "c": {"mode": "onset", "text": "cat", "ms": 80},
    "d": {"mode": "onset", "text": "dip", "ms": 80},
    "g": {"mode": "onset", "text": "gap", "ms": 80},
    "j": {"mode": "onset", "text": "jam", "ms": 110},
    "k": {"mode": "onset", "text": "kit", "ms": 80},
    "p": {"mode": "onset", "text": "pit", "ms": 80},
    "q": {"mode": "onset", "text": "kit", "ms": 80},
    "t": {"mode": "onset", "text": "tap", "ms": 80},
    "ck": {"mode": "onset", "text": "kit", "ms": 80},
    "ch": {"mode": "onset", "text": "chip", "ms": 110},
    "tch": {"mode": "onset", "text": "chip", "ms": 110},
    "dge": {"mode": "onset", "text": "jam", "ms": 110},
    "qu": {"mode": "onset", "text": "quit", "ms": 120},
    "x": {"mode": "nucleus", "text": "box", "skip_ms": 140, "ms": 180},
    "ph": {"mode": "spelling", "text": "fff"},
    # Short vowels (spellings that are sounds, not letter names)
    "a": {"mode": "nucleus", "text": "cat", "skip_ms": 80, "ms": 260},
    "e": {"mode": "spelling", "text": "eh"},
    "i": {"mode": "spelling", "text": "ih"},
    "o": {"mode": "spelling", "text": "ah"},
    "u": {"mode": "spelling", "text": "uh"},
    # Magic e / long vowels
    "a_e": {"mode": "spelling", "text": "ay"},
    "e_e": {"mode": "spelling", "text": "ee"},
    "i_e": {"mode": "spelling", "text": "eye"},
    "o_e": {"mode": "spelling", "text": "oh"},
    "u_e": {"mode": "spelling", "text": "oo"},
    # Vowel teams
    "ai": {"mode": "spelling", "text": "ay"},
    "ay": {"mode": "spelling", "text": "ay"},
    "ea": {"mode": "spelling", "text": "ee"},
    "ee": {"mode": "spelling", "text": "ee"},
    "ie": {"mode": "spelling", "text": "eye"},
    "igh": {"mode": "spelling", "text": "eye"},
    "oa": {"mode": "spelling", "text": "oh"},
    "oe": {"mode": "spelling", "text": "oh"},
    "ow": {"mode": "spelling", "text": "oh"},
    "oo": {"mode": "spelling", "text": "oo"},
    "ou": {"mode": "spelling", "text": "ow"},
    "oi": {"mode": "spelling", "text": "oy"},
    "oy": {"mode": "spelling", "text": "oy"},
    "ue": {"mode": "spelling", "text": "oo"},
    "ew": {"mode": "spelling", "text": "oo"},
    "au": {"mode": "spelling", "text": "aw"},
    "aw": {"mode": "spelling", "text": "aw"},
    # R-controlled
    "ar": {"mode": "spelling", "text": "ar"},
    "er": {"mode": "spelling", "text": "er"},
    "ir": {"mode": "spelling", "text": "er"},
    "or": {"mode": "spelling", "text": "or"},
    "ur": {"mode": "spelling", "text": "er"},
}

STRETCHABLE = {"s", "z", "f", "v", "m", "n", "l", "r", "sh", "th", "ng", "ph"}
VOWELS = {
    "a", "e", "i", "o", "u",
    "a_e", "e_e", "i_e", "o_e", "u_e",
    "ai", "ay", "ea", "ee", "ie", "igh", "oa", "oe", "ow", "oo", "ou",
    "oi", "oy", "ue", "ew", "au", "aw", "ar", "er", "ir", "or", "ur",
}


def ffmpeg(*args: str) -> None:
    subprocess.check_call(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


async def tts_to_mp3(text: str, dest: Path) -> None:
    comm = edge_tts.Communicate(text, VOICE, rate=RATE)
    await comm.save(str(dest))


def silence_trim(src: Path, dest: Path, strip_end: bool = True) -> None:
    # Quiet fricatives (sh, th, f, v) sit near the noise floor, so only
    # strip leading silence for those. Trailing strip uses a lower threshold.
    if strip_end:
        af = (
            "silenceremove=start_periods=1:start_silence=0.01:start_threshold=-40dB:"
            "stop_periods=1:stop_silence=0.08:stop_threshold=-50dB"
        )
    else:
        af = "silenceremove=start_periods=1:start_silence=0.01:start_threshold=-45dB"
    ffmpeg("-i", str(src), "-af", af, str(dest))


def to_mp3(src: Path, dest: Path) -> None:
    ffmpeg("-i", str(src), "-ar", "24000", "-ac", "1", "-b:a", "48k", str(dest))


async def build_clip(key: str, spec: dict, tmp: Path) -> None:
    raw = tmp / f"{key}_raw.mp3"
    wav = tmp / f"{key}.wav"
    out = OUT_DIR / f"{key}.mp3"
    mode = spec["mode"]

    await tts_to_mp3(spec["text"], raw)
    trimmed = tmp / f"{key}_trim.wav"
    # Keep quiet sustained fricatives intact
    strip_end = key not in STRETCHABLE and key not in VOWELS
    silence_trim(raw, trimmed, strip_end=strip_end)

    if mode == "spelling":
        ffmpeg(
            "-i",
            str(trimmed),
            "-af",
            "afade=t=in:st=0:d=0.02,afade=t=out:d=0.06",
            str(wav),
        )
        to_mp3(wav, out)
        return

    if mode == "onset":
        ms = spec["ms"]
        dur = ms / 1000
        fade_start = max(0.02, dur - 0.03)
        ffmpeg(
            "-i",
            str(trimmed),
            "-t",
            f"{dur:.3f}",
            "-af",
            f"afade=t=out:st={fade_start:.3f}:d=0.03",
            str(wav),
        )
        to_mp3(wav, out)
        return

    if mode == "nucleus":
        skip = spec["skip_ms"] / 1000
        dur = spec["ms"] / 1000
        ffmpeg(
            "-ss",
            f"{skip:.3f}",
            "-t",
            f"{dur:.3f}",
            "-i",
            str(trimmed),
            "-af",
            "afade=t=in:st=0:d=0.02,afade=t=out:d=0.05",
            str(wav),
        )
        to_mp3(wav, out)
        return

    raise ValueError(f"Unknown mode {mode} for {key}")


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_s:
        tmp = Path(tmp_s)
        for key, spec in PHONEMES.items():
            try:
                await build_clip(key, spec, tmp)
                size = (OUT_DIR / f"{key}.mp3").stat().st_size
                print(f"OK  {key:6} {size:5d}B  ({spec['mode']}: {spec['text']})")
            except Exception as exc:
                print(f"FAIL {key}: {exc}")
            await asyncio.sleep(0.15)

    print(f"\nWrote {len(list(OUT_DIR.glob('*.mp3')))} clips to {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
