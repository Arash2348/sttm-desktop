// Full text of the Nitnem / Sundar Gutka Banis used by the follower benchmark.
const fs = require('fs');
const IDS = [2, 4, 6, 9, 10, 21, 22, 23, 31];
(async () => {
  for (const id of IDS) {
    const d = await (await fetch(`https://api.banidb.com/v2/banis/${id}`)).json();
    const verses = d.verses.map((v) => ({
      verseId: v.verse.verseId, unicode: v.verse.verse.unicode, paragraph: v.paragraph,
      header: v.header, mangalPosition: v.mangalPosition,
      sgpc: v.existsSGPC, medium: v.existsMedium, taksal: v.existsTaksal, buddhaDal: v.existsBuddhaDal,
    }));
    fs.writeFileSync(`banis/${id}.json`, JSON.stringify({ id, name: d.baniInfo.unicode, verses }, null, 0));
    console.log(id, d.baniInfo.unicode, verses.length);
  }
})();
