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
      const tops = [];
      let run = null;
      for (let x = 0; x < w; x++) {
        let t = -1;
        for (let y = 0; y < h; y++) if (lum(x, y) > 200) { t = y; break; }
        if (t >= 0) { if (!run) run = []; run.push(t); } else if (run) { if (run.length > 3) tops.push(run.sort((a, c) => a - c)[Math.floor(run.length / 4)]); run = null; }
      }
      const common = tops.slice().sort((a, c) => tops.filter((v) => v === c).length - tops.filter((v) => v === a).length)[0];
      const off = tops.filter((t) => Math.abs(t - common) <= 3 && t !== common).length;
      out.push({ font: f, kind, px, glyphs: tops.length, offByOnePx: off, tops: tops.join(' ') });
    }
  }
  console.table(out.map(({ tops, ...r }) => r));
  console.log(JSON.stringify(out));
  await b.close();
})();
