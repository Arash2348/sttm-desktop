# video-meta.py <work dir> <video id> — per-video meta for stage2.js from the channel listing; split BY SINGER
# (<work>/test-singers.txt: one lower-case name per line -> test, else dev), so a test singer never appears in practice
import json, os, sys
W, v = sys.argv[1:3]
ch = {e['id']: e for e in json.load(open(os.path.join(W, 'channel.json')))['entries']}
chan = json.load(open(os.path.join(W, 'channel.json'))).get('channel') or json.load(open(os.path.join(W, 'channel.json'))).get('title') or 'YouTube channel'
tests = [l.strip().lower() for l in open(os.path.join(W, 'test-singers.txt'))] if os.path.exists(os.path.join(W, 'test-singers.txt')) else []
t = ch[v]['title']; singer = t.split(' - ', 1)[1].strip() if ' - ' in t else 'not named in the title'
split = 'test' if any(s and s in singer.lower() for s in tests) else 'dev'
venue = 'Sri Darbar Sahib (Hazoori Ragi)' if 'hazoori' in singer.lower() else 'not named'
sh = json.load(open(os.path.join(W, 'v', v, 'shabads.json')))
m = {"bani": "", "gurdwara": f"YouTube: {chan}, '{t}'", "reader": singer, "acoustics": "hall" if '(live)' in t.lower() else "studio", "mic_path": "broadcast mix (YouTube upload audio)", "split": split,
     "split_note": "new video (manifest origins checked). Split BY SINGER: every video of a singer is in one split, so a held-back singer never appears in practice; one video = one session.",
     "session": f"YouTube-{v}", "truth_provenance": "burned-in publisher slides (full-screen: Gurmukhi, English, transliteration; one pangti per slide), matched to the STTM DB",
     "truth_method": "slide change by frame difference (4 fps), Apple Vision OCR (en-US) of the transliteration, matched to the whole STTM DB (trigram shortlist + edit distance); Shabads with an anchor >= 85 are the clip's Shabads (most time = main); each slide re-matched inside them (>= 65), repeated words taken in order; a pangti row runs from its slide's appearance to its end; our speech model was not used",
     "style": "one ragi jatha", "read_or_sung": "kirtan of a Shabad",
     "notes": f"{chan} channel (owner's data source). Venue: {venue}. Main Shabad {sh['main']}" + (f"; other Shabads sung: {' '.join(map(str, sh['shabads'][1:]))}" if len(sh['shabads']) > 1 else ""),
     "manifest_notes": f"Kirtan, {chan} channel; {singer}; venue {venue}; split by singer ({split}); cache: recorded on x86"}
json.dump(m, open(os.path.join(W, 'v', v, 'video-meta.json'), 'w'), indent=1); print(v, split, singer)
