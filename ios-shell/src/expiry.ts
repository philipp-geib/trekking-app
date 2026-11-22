// Mit SideStore installiert (kostenlose Apple-ID) läuft die App nach 7 Tagen ab. Das Ablaufdatum steht im eingebetteten
// Profil (embedded.mobileprovision, XML-Teil im signierten Block). 2 Tage vorher Hinweis mit Knopf zu SideStore, dazu
// Mitteilungen 1 Tag und 1 Stunde vor Ablauf (auch bei geschlossener App; Schalter „App erneuern“ in den Mitteilungs-Einstellungen
// der Seite → {type:'expiryNotes', on}). Nach jedem Start neu geplant – ein Refresh in SideStore verschiebt sie also beim nächsten Öffnen.
import { File, Paths } from 'expo-file-system';
import { Alert, Linking } from 'react-native';
import { scheduleNotes } from '../modules/local-notes';

export function expiryDate(): Date | null {
  try {
    const f = new File(Paths.bundle, 'embedded.mobileprovision');
    if (!f.exists) return null;
    const bytes = f.bytesSync();
    let text = '';
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    const m = text.match(/<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/);
    const d = m ? new Date(m[1]) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

let warned = false;

/** Beim Öffnen: läuft die App in ≤ 2 Tagen ab → Hinweis (einmal je Start). */
export function checkExpiry() {
  if (warned) return;
  const d = expiryDate();
  if (!d) return;
  const days = (d.getTime() - Date.now()) / 86_400_000;
  if (days > 2) return;
  warned = true;
  const when = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  Alert.alert(
    'TREKKING bald erneuern',
    days <= 0 ? 'Die App ist abgelaufen. Bitte in SideStore erneuern.' : `Die App läuft am ${when} ab. In SideStore „Refresh“ antippen – deine Daten bleiben erhalten.`,
    [
      { text: 'Später', style: 'cancel' },
      { text: 'SideStore öffnen', onPress: () => void Linking.openURL('sidestore://').catch(() => {}) },
    ],
  );
}

const prefFile = new File(Paths.document, 'expiry-notes.json');
const notesOn = () => {
  try {
    return !prefFile.exists || (JSON.parse(prefFile.textSync()) as { on?: boolean }).on !== false;
  } catch {
    return true;
  }
};

/** Schalter von der Seite merken und neu planen. */
export function setExpiryNotes(on: boolean) {
  try {
    if (notesOn() !== on) prefFile.write(JSON.stringify({ on }));
  } catch {}
  planExpiryNotes();
}

let planned = '';
/** Mitteilungen 1 Tag und 1 Stunde vor Ablauf planen (aus = keine, App Store/kein Profil = keine). */
export function planExpiryNotes() {
  const d = expiryDate();
  const on = notesOn();
  const key = `${d?.getTime() ?? 0}:${on}`;
  if (key === planned) return;
  planned = key;
  const t = d?.getTime() ?? 0;
  const body = 'Noch nicht erneuert? In SideStore „Refresh All“ antippen – deine Daten bleiben.';
  void scheduleNotes(
    'expiry-',
    on && t
      ? [
          { id: 'day', title: 'TREKKING läuft morgen ab', body, at: t - 86_400_000 },
          { id: 'hour', title: 'TREKKING läuft in 1 Stunde ab', body, at: t - 3_600_000 },
        ]
      : [],
  );
}
