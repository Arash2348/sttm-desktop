#!/bin/bash
# vm-fetch-ocr.sh <work dir> <picks.txt> <azure prefix> — the download + OCR half of channel-ingest on a Linux VM
# (owner: no downloads or OCR on the Mac). Per video: audio (16 kHz mono wav) + 360p video, slide changes (diffruns.js),
# one frame per slide, tesseract OCR (eng) written in the same ocr.jsonl shape as the Mac's Apple Vision tool
# ({f, lines: [[top 0..1, left 0..1, text]]}); sign-in-blocked videos go to blocked.txt. The video file itself is not
# kept; the rest is pushed to Azure <prefix>/<id>/ for kmatch.js / build2.js (build2 needs the video for contact
# sheets, so 360p is pushed too).
set -uo pipefail
W=$1; PICKS=$2; PFX=$3; H="$(cd "$(dirname "$0")" && pwd)"; YT=/opt/ytvenv/bin/yt-dlp
command -v tesseract >/dev/null || { apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq tesseract-ocr >/dev/null 2>&1; }
[ -x $YT ] || { python3 -m venv /opt/ytvenv && /opt/ytvenv/bin/pip install -q yt-dlp; }
mkdir -p "$W"; cd "$W"; : > blocked.txt
work() { local v=$1 d=$W/v/$1; mkdir -p "$d"
  [ -s "$d/full16k.wav" ] || { $YT -f 251/140 -o "$d/audio.%(ext)s" --no-warnings --no-progress -- "https://www.youtube.com/watch?v=$v" >/dev/null 2>>"$d/err.txt" && ffmpeg -nostdin -loglevel error -i "$(ls "$d"/audio.* | head -1)" -ac 1 -ar 16000 -c:a pcm_s16le -y "$d/full16k.wav" && rm -f "$d"/audio.*; } || { echo "$v $(tail -1 "$d/err.txt")" >> blocked.txt; return; }
  [ -s "$d/video360.webm" ] || { rm -f "$d"/video360.*; $YT -f "243/134/396/605/bv*[height<=360]" -o "$d/video360.%(ext)s" --no-warnings --no-progress -- "https://www.youtube.com/watch?v=$v" >/dev/null 2>>"$d/err.txt" && f=$(ls "$d"/video360.* | head -1) && [ "$f" = "$d/video360.webm" ] || mv "$f" "$d/video360.webm"; } || { echo "$v video $(tail -1 "$d/err.txt")" >> blocked.txt; return; }
  [ -n "${REDO:-}" ] && rm -f "$d/ocr.jsonl"; [ -n "${REDORUNS:-}" ] && rm -f "$d/runs.json"
  [ -s "$d/runs.json" ] || THR=${THR:-0.4} node "$H/diffruns.js" "$d/video360.webm" "${CROP:-full}" "$d/runs.json" >/dev/null
  mkdir -p "$d/band"; node -e 'for(const x of require(process.argv[1]))console.log(x.i,((x.t0+x.t1)/2).toFixed(2))' "$d/runs.json" | while read -r i t; do
    ffmpeg -nostdin -loglevel error -ss "$t" -i "$d/video360.webm" -frames:v 1 -vf "${CROPF:-scale=1920:-2}" -y "$d/band/$(printf %05d "$i").png"; done
  for p in "$d"/band/*.png; do tesseract "$p" - -l eng --psm 3 tsv 2>/dev/null | python3 -c '
import sys,json,collections
rows=[l.rstrip("\n").split("\t") for l in sys.stdin][1:]; W=max([int(r[6])+int(r[8]) for r in rows if len(r)>9 and r[0]=="1"] or [1920]); H=max([int(r[7])+int(r[9]) for r in rows if len(r)>9 and r[0]=="1"] or [990]); L=collections.OrderedDict()
for r in rows:
  if len(r)<12 or r[0]!="5" or not r[11].strip(): continue
  k=(r[2],r[3],r[4]); top,left=int(r[7]),int(r[6]); L.setdefault(k,[top,left,[]]); L[k][0]=min(L[k][0],top); L[k][1]=min(L[k][1],left); L[k][2].append(r[11])
print(json.dumps({"f":sys.argv[1],"lines":[[t/H,l/W," ".join(w)] for t,l,w in L.values()]}))' "$(basename "$p")"; done > "$d/ocr.jsonl"
  rm -rf "$d/band"; echo "$v: $(wc -l < "$d/ocr.jsonl") slides"; }
export -f work; export W H YT THR CROP CROPF REDO REDORUNS
xargs -P 6 -I{} bash -c 'work {}' < "$PICKS"
node "$H/../results-sync.js" push --prefix "$PFX" --dir "$W" --skip 'err.txt$'
