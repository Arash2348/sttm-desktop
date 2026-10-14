#!/usr/bin/env python3
"""Turn one Voice-Follow shadow session (as uploaded to Azure) into the Hugging Face
recording layout that KhalisFoundation/sttm-desktop#2223 pushes (scripts/push_sttm_desktop_recording.py):

    <timestamp>/<timestamp>.wav   16 kHz mono PCM16, the whole session
    <timestamp>/<timestamp>.csv   verseId,timestamp_seconds  (the line the sevadaar showed)

so the Azure data can be pushed to the same datasets later, without any change to the app.

Usage:
    session-to-hf.py <session-dir> [--out <dir>] [--dataset-type paath|kirtan]

<session-dir> is raw/<gurdwara>/<tester>/<date>/<session>/ downloaded from the container:
audio-NNN.webm segments, events.jsonl (audio_segment events give each segment's start),
human.jsonl (the sevadaar's screen: shabadId, verseId, bani, ceremony, slide, t).

Needs ffmpeg on PATH. Prints the push command for the HF script at the end.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SR = 16000


def read_jsonl(path):
    rows = []
    if not path.is_file():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return rows


def ffprobe_duration(path):
    """Seconds of audio in a file (ffprobe when present, else ffmpeg's own header line)."""
    if shutil.which("ffprobe"):
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True,
        )
        try:
            return float(out.stdout.strip())
        except ValueError:
            pass
    # A WebM written while recording has no duration in its header: decode to find out.
    out = subprocess.run(["ffmpeg", "-v", "info", "-i", str(path), "-f", "null", "-"],
                         capture_output=True, text=True)
    m = re.findall(r"time=(\d+):(\d+):(\d+(?:\.\d+)?)", out.stderr)
    if m:
        h, mi, se = m[-1]
        return int(h) * 3600 + int(mi) * 60 + float(se)
    return 0.0


def session_timestamp(session_dir, events):
    """<timestamp> in the HF layout is the recording start as an ISO instant with ':' and '.' -> '-'."""
    meta = session_dir / "session.json"
    if meta.is_file():
        try:
            started = json.loads(meta.read_text(encoding="utf-8")).get("startedAt")
            if started:
                return re.sub(r"[:.]", "-", started)
        except (json.JSONDecodeError, OSError):
            pass
    m = re.search(r"(\d{4}-\d{2}-\d{2})", str(session_dir))
    return f"{m.group(1) if m else 'unknown'}T00-00-00-000Z-{session_dir.name}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("session_dir", type=Path)
    ap.add_argument("--out", type=Path, default=None, help="parent folder for <timestamp>/ (default: next to the session)")
    ap.add_argument("--dataset-type", choices=["paath", "kirtan"], default=None,
                    help="README dataset_type for the push (default: paath when most of the session was a Bani)")
    args = ap.parse_args()
    sd = args.session_dir.expanduser().resolve()
    if not sd.is_dir():
        sys.exit(f"not a directory: {sd}")
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is needed on PATH")

    events = read_jsonl(sd / "events.jsonl")
    human = read_jsonl(sd / "human.jsonl")
    segs = sorted(p for p in sd.glob("audio-*.webm") if p.stat().st_size > 0)
    if not segs:
        sys.exit("no audio-*.webm segments in the session")

    # Each segment starts at its audio_segment event time (seconds since session start);
    # a gap between segments (mic restart) becomes silence so the CSV times stay aligned.
    starts = {e.get("file"): float(e.get("t", 0)) for e in events if e.get("type") == "audio_segment"}
    ts = session_timestamp(sd, events)
    out_dir = (args.out or sd.parent).expanduser().resolve() / ts
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = out_dir / f"{ts}.wav"

    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        cursor = 0.0
        for seg in segs:
            start = starts.get(seg.name, cursor)
            dur = ffprobe_duration(seg)
            if start > cursor + 0.05:
                sil = Path(tmp) / f"sil-{len(parts)}.wav"
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono",
                                "-t", f"{start - cursor:.3f}", str(sil)], check=True)
                parts.append(sil)
                cursor = start
            pcm = Path(tmp) / f"seg-{len(parts)}.wav"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(seg), "-ac", "1", "-ar", str(SR),
                            "-c:a", "pcm_s16le", str(pcm)], check=True)
            parts.append(pcm)
            cursor = start + dur
        lst = Path(tmp) / "list.txt"
        lst.write_text("".join(f"file '{p}'\n" for p in parts))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                        "-c", "copy", str(wav)], check=True)

    # verseId,timestamp_seconds: every screen change that showed a line (slides have none).
    rows = []
    bani_s = 0.0
    last_t = None
    last_bani = False
    for h in human:
        t = float(h.get("t", 0))
        if last_t is not None:
            bani_s += (t - last_t) if last_bani else 0.0
        last_t, last_bani = t, bool(h.get("bani"))
        if h.get("verseId") is None:
            continue
        rows.append((h["verseId"], t))
    total = ffprobe_duration(wav)
    if last_t is not None and last_bani:
        bani_s += max(0.0, total - last_t)
    csv = out_dir / f"{ts}.csv"
    csv.write_text("verseId,timestamp_seconds\n" + "".join(f"{v},{t:.3f}\n" for v, t in rows))

    dtype = args.dataset_type or ("paath" if total and bani_s / total >= 0.5 else "kirtan")
    gurdwara = sd.parents[2].name if len(sd.parents) > 2 else "gurdwara"
    print(f"{wav}  ({total:.0f} s, {len(segs)} segments)")
    print(f"{csv}  ({len(rows)} verse rows)")
    print("push with:")
    print(f"  HF_TOKEN_KHALIS=... python3 scripts/push_sttm_desktop_recording.py '{out_dir}' "
          f"--collection '{gurdwara}' --dataset-type {dtype}")


if __name__ == "__main__":
    main()
