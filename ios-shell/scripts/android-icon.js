// Android-Symbol (adaptiv, Nutzer 25.11.: wie das iPhone-Symbol Blaugrün dunkel statt Startbild mit Schriftzug):
// Hintergrund = Verlauf, Vordergrund = leuchtender Schuh in der sicheren Zone (66 %), Monochrom = Schuh weiß (Android 13 „Designsymbole“).
// node scripts/android-icon.js  (Playwright) → assets/android/icon-{bg,fg,mono}.png
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { ICON_COLORS } = require('../plugins/iconColors');
const out = path.join(__dirname, '../assets/android');
const HEX = ICON_COLORS.find(([k]) => k === 'blaugruen')[1];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.addScriptTag({ path: path.join(__dirname, '../../app/public/app-icon.js') });
  const shots = await p.evaluate((hex) => {
    const C = CanvasRenderingContext2D.prototype;
    const fillRect = C.fillRect, fill = C.fill;
    const pad = (cv, size, k) => {
      const o = document.createElement('canvas');
      o.width = o.height = size;
      const s = size * k;
      o.getContext('2d').drawImage(cv, (size - s) / 2, (size - s) / 2, s, s);
      return o;
    };
    // Hintergrund: nur der Verlauf
    C.fill = function () {};
    const bg = trekIcon(1024, hex, true).toDataURL('image/png');
    C.fill = fill;
    // Vordergrund: nur der Schuh (sichtbar sind 72 von 108 dp → 2/3)
    C.fillRect = function () {};
    const fg = pad(trekIcon(1024, hex, true), 1024, 2 / 3);
    // Monochrom: Schuh ohne Schein, weiß
    const raw = trekIcon(1024, hex, true);
    C.fillRect = fillRect;
    const m = pad(raw, 1024, 0.6);
    const x = m.getContext('2d');
    const d = x.getImageData(0, 0, 1024, 1024);
    for (let i = 0; i < d.data.length; i += 4) {
      const a = d.data[i + 3] > 150 ? 255 : 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
      d.data[i + 3] = a;
    }
    x.putImageData(d, 0, 0);
    return { bg, fg: fg.toDataURL('image/png'), mono: m.toDataURL('image/png') };
  }, HEX);
  for (const [k, url] of Object.entries(shots)) fs.writeFileSync(path.join(out, `icon-${k}.png`), Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
})();
