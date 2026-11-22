// Schreibt die App-Symbole der Hülle (assets/appicons/<farbe>-hell|dunkel.png, 1024 px, ohne Alpha) aus app/public/app-icon.js –
// eins je Vorgabe-Farbe (app/src/lib/palette.ts PRIMARIES). plugins/withAppIcons.js baut daraus die Wechsel-Symbole.
// node scripts/app-icons.js  (Playwright + python3 mit PIL)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ICON_COLORS } = require('../plugins/iconColors');
const out = path.join(__dirname, '../assets/appicons');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.addScriptTag({ path: path.join(__dirname, '../../app/public/app-icon.js') });
  for (const [key, hex] of ICON_COLORS)
    for (const dark of [false, true]) {
      const url = await p.evaluate(([h, d]) => trekIcon(1024, h, d).toDataURL('image/png'), [hex, dark]);
      fs.writeFileSync(path.join(out, `${key}-${dark ? 'dunkel' : 'hell'}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
  await b.close();
  // ohne Alpha (iOS)
  execFileSync('python3', ['-c', `
import glob
from PIL import Image
for f in glob.glob(${JSON.stringify(out + '/*.png')}):
    Image.open(f).convert('RGB').save(f, optimize=True)
`]);
})();
