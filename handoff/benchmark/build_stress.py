#!/usr/bin/env python3
"""Build a 1-2-line RAPID-SWITCH stress dataset from the eval-kirtan-canonical clips.

Unlike kirtan_full (real timeline, ~40s median per shabad), this switches shabad on
almost every segment: one short (~5-10s = 1-2 lines) clip per distinct shabad, back to
back. Stress-tests whether the follower can lock and switch FAST. Same manifest format
as kirtan_manifest.json so vf-kirtan-switch-eval.js reads it via WAV=/MANIFEST=.
"""
import glob
import json
import subprocess

import numpy as np
import pyarrow.parquet as pq

SR = 16000
FFMPEG = "/Users/asingh02/Library/Python/3.9/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
OUT_WAV = "/Users/asingh02/aai/kirtan_bench/kirtan_stress_16k.wav"
OUT_MAN = "/Users/asingh02/aai/kirtan_bench/kirtan_stress_manifest.json"
FULL_MAN = "/Users/asingh02/aai/kirtan_bench/kirtan_manifest.json"
N_SHABADS = 40  # distinct shabads -> that many rapid switches
DUR_LO, DUR_HI = 5.0, 10.0


def decode_16k(wav_bytes):
    """Decode arbitrary WAV bytes -> 16k mono float32 via ffmpeg stdin/stdout."""
    p = subprocess.run(
        [FFMPEG, "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", str(SR), "pipe:1"],
        input=wav_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
    )
    return np.frombuffer(p.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def wav_write(path, samples):
    import wave
    x = np.clip(samples, -1, 1)
    pcm = (x * 32767).astype("<i2").tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)


def main():
    f = sorted(glob.glob("/Users/asingh02/aai/models/eval-kirtan-canonical/data/*.parquet"))[0]
    rows = pq.read_table(f).to_pylist()
    full = json.load(open(FULL_MAN))
    lines = full["lines"]

    # For each shabad, pick its best short clip: real Bani (non-empty line, not simran),
    # duration in [DUR_LO, DUR_HI], highest canonical_match_score.
    best = {}
    for r in rows:
        sid = r["canonical_shabad_id"]
        if sid not in lines:
            continue
        if r.get("is_simran"):
            continue
        if not (r.get("sggs_line") or "").strip():
            continue
        d = r["duration_s"]
        if not (DUR_LO <= d <= DUR_HI):
            continue
        sc = r.get("canonical_match_score") or 0
        if sid not in best or sc > best[sid][0]:
            best[sid] = (sc, r)

    # Deterministic pick: highest-scoring shabads first (cleanest audio), then sort by id
    # so adjacent segments are unrelated shabads.
    chosen = sorted(best.items(), key=lambda kv: -kv[1][0])[:N_SHABADS]
    chosen = sorted(chosen, key=lambda kv: kv[0])

    gap = np.zeros(int(0.3 * SR), dtype=np.float32)
    parts, segs, cum = [], [], 0
    for sid, (sc, r) in chosen:
        a = decode_16k(r["audio"]["bytes"])
        start = cum / SR
        parts.append(a)
        cum += len(a)
        segs.append({
            "shabadId": sid, "start": round(start, 3), "end": round(cum / SR, 3),
            "startSamp": int(start * SR), "endSamp": cum,
            "clipDur": round(len(a) / SR, 2),
        })
        parts.append(gap)
        cum += len(gap)

    total = np.concatenate(parts)
    wav_write(OUT_WAV, total)
    json.dump({"sr": SR, "segments": segs, "lines": lines}, open(OUT_MAN, "w"))

    durs = [s["clipDur"] for s in segs]
    print(f"wrote {OUT_WAV}  ({len(total)/SR/60:.1f} min, {len(total)} samples)")
    print(f"segments: {len(segs)}  switches: {len(segs)-1}")
    print(f"seg duration: min {min(durs):.1f}s  median {sorted(durs)[len(durs)//2]:.1f}s  max {max(durs):.1f}s")
    print(f"shabads: {', '.join(s['shabadId'] for s in segs[:12])} ...")


if __name__ == "__main__":
    main()
