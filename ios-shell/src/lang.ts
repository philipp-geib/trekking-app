// Sprache der App (die Seite meldet sie per {type:'lang'}) – für Texte der Hülle selbst: Ablauf-Hinweis/-Mitteilungen,
// Aufzeichnungs-Mitteilung (Android), Standort-Hinweis. Gemerkt, damit sie auch beim nächsten Start vor dem Laden der Seite gilt.
import { File, Paths } from 'expo-file-system';

const file = new File(Paths.document, 'lang.json');
let lang: 'de' | 'en' = (() => {
  try {
    return file.exists && JSON.parse(file.textSync()) === 'en' ? 'en' : 'de';
  } catch {
    return 'de';
  }
})();

export const isEn = () => lang === 'en';

/** Neue Sprache merken; true = hat sich geändert */
export function setLang(l: unknown): boolean {
  const next = l === 'en' ? 'en' : 'de';
  if (next === lang) return false;
  lang = next;
  try {
    file.write(JSON.stringify(next));
  } catch {}
  return true;
}
