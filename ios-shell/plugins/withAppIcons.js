// Wechsel-Symbole fürs iPhone: je Vorgabe-Farbe drei Symbole – „<farbe>-hell“, „<farbe>-dunkel“ und „<farbe>-auto“ (hell + dunkel als
// Erscheinungsbild, iOS 18 wechselt selbst mit dem Dunkelmodus). Die Seite wählt per {type:'icon'} (modules/app-icon), Bilder aus scripts/app-icons.js.
// Legt die Symbol-Sätze im Asset-Katalog an und sagt actool, dass es sie als Alternate Icons einbauen soll (schreibt CFBundleAlternateIcons selbst).
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { ICON_COLORS } = require('./iconColors');

const MODES = ['hell', 'dunkel', 'auto'];
const NAMES = ICON_COLORS.flatMap(([k]) => MODES.map((m) => `${k}-${m}`));

const image = (file, dark) => ({
  ...(dark ? { appearances: [{ appearance: 'luminosity', value: 'dark' }] } : {}),
  filename: file,
  idiom: 'universal',
  platform: 'ios',
  size: '1024x1024',
});

function writeSets(root, catalog) {
  const src = path.join(root, 'assets/appicons');
  for (const [key] of ICON_COLORS)
    for (const mode of MODES) {
      const dir = path.join(catalog, `${key}-${mode}.appiconset`);
      fs.mkdirSync(dir, { recursive: true });
      const images = [];
      for (const look of mode === 'auto' ? ['hell', 'dunkel'] : [mode]) {
        const file = `${key}-${look}.png`;
        fs.copyFileSync(path.join(src, file), path.join(dir, file));
        images.push(image(file, mode === 'auto' && look === 'dunkel'));
      }
      fs.writeFileSync(path.join(dir, 'Contents.json'), JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2));
    }
}

module.exports = function withAppIcons(config) {
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const catalog = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName, 'Images.xcassets');
      writeSets(c.modRequest.projectRoot, catalog);
      return c;
    },
  ]);
  return withXcodeProject(config, (c) => {
    const configs = c.modResults.pbxXCBuildConfigurationSection();
    for (const k of Object.keys(configs)) {
      const s = configs[k].buildSettings;
      if (!s || !s.PRODUCT_NAME || s.WRAPPER_EXTENSION === 'appex' || !s.INFOPLIST_FILE || /LiveActivity/.test(String(s.INFOPLIST_FILE))) continue;
      s.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = `"${NAMES.join(' ')}"`;
      s.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
    }
    return c;
  });
};
