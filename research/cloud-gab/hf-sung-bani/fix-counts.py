# fix-counts.py <stage> — lines_n / shabads_n of the staged (new) rows = the rows in their lines.csv / shabads.csv
import csv, io, os, sys
st = sys.argv[1]; mf = os.path.join(st, 'manifest.csv'); lines = open(mf, newline='').read().split('\n'); head = next(csv.reader([lines[0]]))
I = {k: i for i, k in enumerate(head)}; out = [lines[0]]; n = 0
for l in lines[1:]:
    if not l.strip(): out.append(l); continue
    r = next(csv.reader([l])); d = os.path.join(st, r[I['content_folder']], r[0])
    if os.path.isdir(d) and os.path.exists(os.path.join(d, 'lines.csv')) and os.path.exists(os.path.join(d, 'audio.wav')):
        r[I['lines_n']] = str(sum(1 for x in open(os.path.join(d, 'lines.csv')) if x.strip()) - 1)
        r[I['shabads_n']] = str(sum(1 for x in open(os.path.join(d, 'shabads.csv')) if x.strip()) - 1)
        b = io.StringIO(); csv.writer(b, lineterminator='').writerow(r); nl = b.getvalue()
        if nl != l: n += 1
        out.append(nl)
    else: out.append(l)
open(mf, 'w', newline='').write('\n'.join(out)); print('rows updated', n)
