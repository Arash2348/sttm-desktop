// Renders the pangti from the report in each Gurbani Akhar font, as shipped (hinted) and with
// the hinting removed, at overlay sizes, and measures how far each akhar's top edge strays
// from the others (0 px = every akhar level).
const puppeteer = require('puppeteer');
const { PNG } = require('pngjs');
const path = require('path');
const PANGTI = 'guru Arjunu Gir gur rwmdws AprMpru bIxw ]3]';
const FONTS = ['GurbaniAkharTrue', 'GurbaniAkharHeavyTrue', 'GurbaniAkharThickTrue'];
const SIZES = [24, 28, 32, 36, 40, 48, 56];
const fs = require('fs');
const url = (p) => 'data:font/ttf;base64,' + fs.readFileSync(path.resolve(p)).toString('base64');
(async () => {
  const b = await puppeteer.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1400, height: 200 });
  const out = [];
  for (const f of FONTS) for (const kind of ['hinted', 'unhinted']) {
    const file = kind === 'hinted' ? `www/obs/${f}.ttf` : `research/fontcheck/unhinted/${f}.ttf`;
    for (const px of SIZES) {
      await p.setContent(`<style>@font-face{font-family:T;src:url('${url(file)}')}body{margin:0;background:#000}div{font-family:T;font-size:${px}px;color:#fff;padding:20px;white-space:nowrap}</style><div>${PANGTI}</div>`);
      await p.evaluateHandle('document.fonts.ready');
      const loaded = await p.evaluate(() => document.fonts.check('20px T'));
      if (!loaded) throw new Error('font did not load: ' + file);
      const png = PNG.sync.read(await p.screenshot());
      const { width: w, height: h, data } = png;
      const lum = (x, y) => data[(y * w + x) * 4];
      // Headline (the bar along the top of each akhar): for each column, the first row that starts
      // a solid run of ink. Every column should share one row; count the columns that do not.
      const head = [];
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h - 3; y++) {
          if (lum(x, y) > 160 && lum(x, y + 1) > 160 && lum(x, y + 2) > 160) { head.push(y); break; }
        }
      }
      const counts = {};
      head.forEach((y) => { counts[y] = (counts[y] || 0) + 1; });
      const mode = Number(Object.keys(counts).sort((a, c) => counts[c] - counts[a])[0]);
      const near = head.filter((y) => Math.abs(y - mode) <= 3);
      const off = near.filter((y) => y !== mode).length;
      const tops = near;
      fs.mkdirSync('shots', { recursive: true });
      fs.writeFileSync(`shots/${f}-${kind}-${px}.png`, PNG.sync.write(png));
      out.push({ font: f, kind, px, columns: near.length, offColumns: off, pctOff: Math.round((1000 * off) / Math.max(1, near.length)) / 10 });
    }
  }
  console.table(out);
  console.log(JSON.stringify(out));
  await b.close();
})();
