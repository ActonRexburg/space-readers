#!/usr/bin/env python3
"""Batch edge-tts synthesizer used by scripts/gen-voice.mjs.

Reads JSON jobs from a file:
  [{ "id", "text", "voice", "rate", "pitch", "out", "meta" }, ...]

Writes the mp3 plus a sibling meta JSON with WordBoundary timings.
Keeps one event loop so we are not opening a new process per clip.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import edge_tts

TICKS_PER_MS = 10_000


async def one_clip(job: dict) -> None:
    text = job["text"]
    communicate = edge_tts.Communicate(
        text,
        job["voice"],
        rate=job["rate"],
        pitch=job["pitch"],
        boundary="WordBoundary",
    )
    words: list[dict] = []
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            words.append(
                {
                    "text": chunk.get("text", ""),
                    "offsetMs": int(chunk["offset"] / TICKS_PER_MS),
                    "durationMs": int(chunk.get("duration", 0) / TICKS_PER_MS),
                }
            )
    if not audio:
        raise RuntimeError("No audio was received")
    Path(job["out"]).write_bytes(bytes(audio))
    Path(job["meta"]).write_text(json.dumps({"words": words}), encoding="utf-8")


async def run_job(job: dict, attempts: int = 4) -> dict:
    last = ""
    for i in range(attempts):
        try:
            await one_clip(job)
            return {"id": job["id"], "ok": True}
        except Exception as exc:
            last = str(exc)
            await asyncio.sleep(1.2 * (i + 1))
    return {"id": job["id"], "ok": False, "error": last}


async def main() -> int:
    jobs_path = sys.argv[1]
    jobs = json.loads(Path(jobs_path).read_text(encoding="utf-8"))
    results = []
    for i, job in enumerate(jobs):
        result = await run_job(job)
        results.append(result)
        status = "OK" if result["ok"] else "FAIL"
        print(f"{status} {i + 1}/{len(jobs)} {job['id']}", flush=True)
        if not result["ok"]:
            print(f"  {result.get('error', '')}", flush=True)
        await asyncio.sleep(0.08)
    Path(jobs_path + ".results.json").write_text(json.dumps(results), encoding="utf-8")
    failed = sum(1 for r in results if not r["ok"])
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
