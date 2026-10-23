#!/usr/bin/env python3
"""Encode each recording's own audio (the exact file GAB replayed) as a small mp3 for the PRIVATE viewer, so playback
and the timeline come from the same audio. Output: private-fixed/audio/<id>.mp3 and private-fixed/audio/index.json."""
import json, os, glob, re, subprocess
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
amap = json.load(open(f'{B}/audio-map.json'))
out = f'{B}/private-fixed/audio'; os.makedirs(out, exist_ok=True)
safe = lambda i: re.sub(r'[^A-Za-z0-9_.-]', '_', i)
clips = {}
for f in glob.glob(f'{B}/private-fixed/timeline/*.json'):
    if f.endswith('index.json'): continue
    for c in json.load(open(f))['clips']: clips[c['id']] = c
done = {}
for i, c in sorted(clips.items()):
    dst = f'{out}/{safe(i)}.mp3'
    if i in amap: args = ['-i', amap[i]]
    elif i.startswith('kbv1_') and c.get('yt'):
        src = os.path.expanduser(f"~/AAI/models/benchmark/audio/{c['yt']['v']}_16k.wav")
        if not os.path.exists(src): continue
        args = ['-ss', str(c['yt']['at']), '-t', str(c['dur']), '-i', src]
    else: continue
    if not os.path.exists(dst):
        subprocess.run(['nice', '-n', '19', 'ffmpeg', '-v', 'error', '-y', *args, '-ac', '1', '-ar', '22050', '-b:a', '32k', dst], check=True)
    done[i] = f'audio/{safe(i)}.mp3'
json.dump(done, open(f'{out}/index.json', 'w'))
print(len(done), 'of', len(clips), 'recordings encoded;', round(sum(os.path.getsize(f'{out}/{os.path.basename(v)}') for v in done.values()) / 1e6), 'MB')
