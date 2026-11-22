// iPhone: Live-Aktivität auf dem Sperrbildschirm (und in der Dynamic Island), solange eine Tour läuft – nächste Abbiegung
// mit Pfeil, Reststrecke, Fortschrittsbalken. Ohne Tourlinie nur „Aufzeichnung läuft“. Antippen öffnet die Navigation.
// Entsperren ersetzt sie nicht (Apple lässt keine App über den Sperrbildschirm), aber man sieht das Wichtigste sofort.
import { Platform } from 'react-native';
import * as LiveActivity from 'expo-live-activity';
import type { Guide } from '../../app/src/lib/turns';

const IOS = Platform.OS === 'ios';
const CONFIG: LiveActivity.LiveActivityConfig = {
  backgroundColor: '#438482',
  titleColor: '#ffffff',
  subtitleColor: '#e3efee',
  progressViewTint: '#ffffff',
  progressViewLabelColor: '#ffffff',
  deepLinkUrl: 'open?to=/navigation',
  imagePosition: 'left',
  imageAlign: 'center',
  imageSize: { width: 44, height: 44 },
  contentFit: 'contain',
  padding: { horizontal: 16, vertical: 14 },
};

let id: string | null = null;
let last = '';

/** Kurz und gerundet – ändert sich seltener → weniger Aktualisierungen (Akku) */
export function shortDistance(m: number, en: boolean) {
  if (m >= 1000) {
    const km = (Math.round(m / 100) / 10).toFixed(1);
    return `${en ? km : km.replace('.', ',')} km`;
  }
  return `${m >= 200 ? Math.round(m / 50) * 50 : Math.round(m / 10) * 10} m`;
}

export function imageFor(g: Pick<Guide, 'kind' | 'side'>) {
  const side = g.side ?? 'right';
  switch (g.kind) {
    case 'finish': return 'finish';
    case 'straight': return 'straight';
    case 'uturn': return 'uturn';
    case 'slight': return `slight-${side}`;
    case 'sharp':
    case 'curve': return `sharp-${side}`;
    default: return side;
  }
}

function show(state: LiveActivity.LiveActivityState) {
  if (!IOS) return;
  const key = JSON.stringify(state);
  if (key === last) return;
  last = key;
  try {
    if (id) LiveActivity.updateActivity(id, state);
    else id = LiveActivity.startActivity(state, CONFIG) || null;
  } catch {
    // Live-Aktivitäten aus (Einstellungen) oder iOS < 16.2
  }
}

/** Tour läuft ohne Linie (nur Aufzeichnung) */
export function activityRecording(startedAt: number, en: boolean) {
  const t = new Date(startedAt).toLocaleTimeString(en ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit' });
  show({ title: en ? 'Recording' : 'Aufzeichnung läuft', subtitle: en ? `since ${t}` : `seit ${t} Uhr`, imageName: 'rec', dynamicIslandImageName: 'rec' });
}

/** Unterwegs auf der Tour: `text` = Hinweis wie in der Ansage („rechts abbiegen“) */
export function activityGuide(g: Guide, text: string, along: number, length: number, near: number, en: boolean) {
  const left = Math.max(0, length - along);
  const now = g.dist <= near;
  let title: string;
  if (g.kind === 'finish') title = now ? (en ? 'Destination reached' : 'Ziel erreicht') : en ? `Destination in ${shortDistance(g.dist, en)}` : `Ziel in ${shortDistance(g.dist, en)}`;
  else if (g.kind === 'straight') title = en ? 'Follow the tour' : 'Der Tour folgen';
  else title = now ? `${en ? 'Now' : 'Jetzt'} ${text}` : `In ${shortDistance(g.dist, en)} ${text}`;
  const img = imageFor(g);
  show({
    title,
    subtitle: en ? `${shortDistance(left, en)} to go` : `Noch ${shortDistance(left, en)}`,
    progressBar: { progress: length > 0 ? Math.round((along / length) * 100) / 100 : 0 },
    imageName: img,
    dynamicIslandImageName: img,
  });
}

/** Neben der Tour */
export function activityOff(distance: number, along: number, length: number, en: boolean) {
  show({
    title: en ? 'Off the tour' : 'Tour verlassen',
    subtitle: en ? `${shortDistance(distance, en)} away` : `${shortDistance(distance, en)} daneben`,
    progressBar: { progress: length > 0 ? Math.round((along / length) * 100) / 100 : 0 },
    imageName: 'off',
    dynamicIslandImageName: 'off',
  });
}

export function activityStop() {
  if (!IOS || !id) return;
  const was = id;
  id = null;
  last = '';
  try {
    LiveActivity.stopActivity(was, { title: 'TREKKING' });
  } catch {
    // schon weg
  }
}
