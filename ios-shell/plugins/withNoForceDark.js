// Android: kein vom System/Hersteller erzwungenes Abdunkeln (Force Dark, z. B. „Dunkelmodus für Apps“ bei Xiaomi/Samsung).
// Sonst dunkelt die WebView die Seite selbst ab – auch wenn in TREKKING „Hell“ gewählt ist. Dunkel macht die Seite selbst
// (html.dark, Profil → Design); „Auto“ folgt dem System über prefers-color-scheme (Theme bleibt DayNight).
const { withAndroidStyles, AndroidConfig } = require('expo/config-plugins');

module.exports = function withNoForceDark(config) {
  return withAndroidStyles(config, (c) => {
    c.modResults = AndroidConfig.Styles.assignStylesValue(c.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:forceDarkAllowed',
      value: 'false',
    });
    return c;
  });
};
