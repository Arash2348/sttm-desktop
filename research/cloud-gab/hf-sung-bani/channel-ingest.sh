#!/bin/bash
# channel-ingest.sh — one command per YouTube kirtan channel with on-screen Gurbani slides -> GAB clips ready to verify.
#   bash channel-ingest.sh <work dir> <channel url> <prefix> [picks.txt]
#   1. lists the channel (flat, polite); without picks.txt it writes <work>/channel.tsv and stops so you can choose
#   2. per picked video: duplicate check against the GAB manifest (HF main), audio (16 kHz mono) + 360p video,
#      sign-in-blocked videos are skipped and listed in <work>/blocked.txt (never cookies, never a bypass)
#   3. slide changes (diffruns.js), one OCR frame per slide (Apple Vision, macOS: bin/ocr from ocr.swift),
#      whole-DB slide matching (kmatch.js), one clip per video (build2.js) with lines.csv / shabads.csv / contact sheet
#   4. per-video meta (singer from the title "Shabad - Singer"; split BY SINGER: names in <work>/test-singers.txt -> test)
#   Then: an independent verifier checks <work>/v/*/sheets (verdicts.json next to each sheet); stage with stage2.js on
#   the current dataset manifest; push the stage to Azure (results-sync.js push --prefix sung-bani-data/<name>);
#   VM job sungbani (cg-sbstage, cg-sbidre=^<prefix>_, cg-sbfolders=1-kirtan-shabad, cg-sbsplits='test dev') records
#   + scores 9.0.4; hf-pr.js <stage> [--after-pr N] --commit opens the dataset PR (token ~/.vf-hf-token-write).
set -euo pipefail
W=$1; URL=$2; PRE=$3; PICKS=${4:-}
H="$(cd "$(dirname "$0")" && pwd)"; YT="$HOME/.local/bin/uvx yt-dlp"; FF=$HOME/.local/bin/ffmpeg
mkdir -p "$W/v" "$W/out" "$W/bin"
cd "$W"
[ -s channel.json ] || $YT --flat-playlist -J --no-warnings --sleep-requests 1 "$URL" > channel.json
python3 -I -c "import json;[print(e['id'],e.get('duration'),e.get('title'),sep='\t') for e in json.load(open('channel.json'))['entries']]" > channel.tsv
[ -n "$PICKS" ] || { echo "listed $(wc -l < channel.tsv) videos in $W/channel.tsv; write picks.txt (one id per line) and rerun"; exit 0; }
[ -x bin/ocr ] || swiftc -O "$H/ocr.swift" -o bin/ocr
[ -s allverses.json ] || node "$H/alltr.js"
curl -sSfL -H "Authorization: Bearer $(tr -d '\r\n ' < ~/.vf-hf-token-write)" -o manifest.main.csv https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench/resolve/main/manifest.csv
: > blocked.txt
while read -r v; do
  [ -n "$v" ] || continue
  if grep -q -- "$v" manifest.main.csv; then echo "$v already in GAB: skipped"; continue; fi
  d=v/$v; mkdir -p "$d"
  if [ ! -s "$d/full16k.wav" ]; then
    nice -n 19 $YT -f 251/140 -o "$d/audio.%(ext)s" --no-warnings --no-progress --sleep-requests 1 -- "https://www.youtube.com/watch?v=$v" >/dev/null 2>>"$d/err.txt" || { echo "$v $(tail -1 "$d/err.txt")" >> blocked.txt; continue; }
    f=$(ls "$d"/audio.* | head -1); nice -n 19 $FF -nostdin -loglevel error -i "$f" -ac 1 -ar 16000 -c:a pcm_s16le -y "$d/full16k.wav" && rm "$f"
  fi
  if [ ! -e "$d/video360.webm" ]; then
    nice -n 19 $YT -f "243/134/396/605/bv*[height<=360]" -o "$d/video360.%(ext)s" --no-warnings --no-progress -- "https://www.youtube.com/watch?v=$v" >/dev/null 2>>"$d/err.txt" || { echo "$v video: $(tail -1 "$d/err.txt")" >> blocked.txt; continue; }
    vf=$(ls "$d"/video360.* | head -1); [ "$vf" = "$d/video360.webm" ] || ln -sf "$(basename "$vf")" "$d/video360.webm"
  fi
  [ -s "$d/runs.json" ] || THR=0.4 nice -n 19 node "$H/diffruns.js" "$d/video360.webm" 640:330:0:0 "$d/runs.json"
  if [ ! -s "$d/ocr.jsonl" ]; then
    mkdir -p "$d/band"; node -e 'for(const x of require(process.argv[1]))console.log(x.i,((x.t0+x.t1)/2).toFixed(2))' "$PWD/$d/runs.json" | while read -r i t; do
      nice -n 19 $FF -nostdin -loglevel error -ss "$t" -i "$d/video360.webm" -frames:v 1 -vf "crop=640:330:0:0,scale=1920:990" -y "$d/band/$(printf %05d "$i").png"; done
    nice -n 19 bin/ocr "$d/band" > "$d/ocr.jsonl"; rm -rf "$d/band"
  fi
  nice -n 19 node "$H/kmatch.js" "$d" allverses.json
  node -e '
    const [v,W,PRE]=process.argv.slice(1);const fs=require("fs");const d=JSON.parse(fs.readFileSync(`${W}/v/${v}/shabads.json`));const D=(fs.statSync(`${W}/v/${v}/full16k.wav`).size-44)/32000;
    fs.writeFileSync(`${W}/v/${v}/config.json`,JSON.stringify({dir:`${W}/v/${v}`,out:`${W}/out`,video:v,prefix:PRE,folder:"1-kirtan-shabad",unit:String(d.main),source:"broadcast-caption",crop:"640:330:0:0",cuts:[[[0,0.5],[Math.max(0,D-2.5),D-0.1]]]}));' "$v" "$PWD" "$PRE"
  nice -n 19 node "$H/build2.js" "$d/config.json"
  python3 -I "$H/video-meta.py" "$PWD" "$v"
done < "$PICKS"
echo "done; blocked: $(wc -l < blocked.txt) (see blocked.txt). Next: verifier on $W/v/*/sheets, then stage2.js + hf-pr.js + VM job."
