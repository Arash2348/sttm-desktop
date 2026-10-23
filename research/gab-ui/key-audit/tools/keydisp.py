import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit as A
O = json.load(open('out_for_report.json'))
ks = {k for x in O['rows'] for f in x['findings'] for k in (f.get('key_shabad') or [])}
def disp(s):
    for v in sorted(A.sh_verses[s]):
        t = A.verse[v]['text']
        if len(t.split()) >= 4 and 'ਮਹਲਾ' not in t and 'ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ' not in t and not t.startswith('ਸਲੋਕ') and not t.endswith('ਛੰਦ ॥'): return t
    return A.verse[sorted(A.sh_verses[s])[0]]['text']
json.dump({k: disp(k) for k in ks}, open('keydisp.json', 'w'), ensure_ascii=False)
print(json.load(open('keydisp.json')))
