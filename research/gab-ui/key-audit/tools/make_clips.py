# Build clips.json (next to these scripts): every public recording in the GAB viewer timelines ->
# its current HF answer keys (snapshot in ./hfkeys, csv + meta only), local audio and speech-model cache.
# hfkeys: huggingface_hub.snapshot_download('khalisfoundation/GurbaniAutopilotBench', repo_type='dataset',
#         allow_patterns=['*.csv'], local_dir='hfkeys')  (read only; token from ~/.vf-hf-token)
import json, csv, os, glob
H = os.path.dirname(os.path.abspath(__file__))
TL = os.path.expanduser('~/personal/sttm-ws3/research/gab-ui/site/timeline')
CACHE = os.path.expanduser('~/personal/live-darbar-venues/cache/5f9e41d867de-q16')
KB = os.path.expanduser('~/personal/sttm-replay/research/level2-dataset/kbv1-bench/1-kirtan-shabad')
ids = {}
for f in glob.glob(TL + '/v905*.json'):
    tier = f.rsplit('-', 1)[1][:-5]
    for c in json.load(open(f))['clips']: ids[c['id']] = (tier, c['folder'], c['basis'], c['dur'])
man = {r['id']: r for r in csv.DictReader(open(os.path.join(H, 'hfkeys/manifest.csv')))}
out = {}
for i, (tier, folder, basis, dur) in ids.items():
    if i.startswith('kbv1'):
        out[i] = dict(tier=tier, folder=folder, keys=f'{KB}/{i}', cache=f'{CACHE}/{i}', dur=dur, basis=basis,
                      audio=os.path.expanduser(f'~/personal/live-darbar-venues/clips/{i}.wav'))
        continue
    m = man[i]
    kd = (glob.glob(os.path.join(H, f'hfkeys/*/{i}')) + glob.glob(os.path.join(H, f'hfkeys/*/*/{i}')))[0]
    cid = m['cache_id'] or i
    cd = [c for c in (CACHE + '-x86/' + cid, CACHE + '/' + cid) if os.path.exists(c + '/index.jsonl')]
    aud = [a for a in (os.path.expanduser('~/personal/vf-benchmark/' + m['audio']),
                       os.path.expanduser('~/personal/live-darbar-venues/clips/' + m['source_file'])) if os.path.isfile(a)]
    out[i] = dict(tier=tier, folder=m['content_folder'], keys=kd, cache=cd[0] if cd else None, audio=aud[0] if aud else None, dur=dur, basis=basis)
json.dump(out, open(os.path.join(H, 'clips.json'), 'w'), indent=0)
print(len(out))
