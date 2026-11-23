// Kilometer-Ansage bei gesperrtem Bildschirm (Laufen/Wandern): die Web-App schickt nach jedem Punkt ihren Stand ({type:'km'}), hier wird im
// Hintergrund mit derselben Rechnung weitergezählt (GPS-Filter app/src/lib/trackFilter.ts, Zähler app/src/lib/kmVoice.ts). Nach dem Entsperren
// spielt die Web-App die Punkte ohne Ansagen nach und kommt auf denselben Stand.
import { kmStep, type KmState } from '../../app/src/lib/kmVoice';
import type { Sport } from '../../app/src/lib/sport';
import { speedForFilter, trackStep, type Kf } from '../../app/src/lib/trackFilter';
import { sayInBackground } from './guide';
import type { Loc } from './location';

type Last = { lat: number; lng: number; time: number };
export type KmMsg = { on: boolean; en: boolean; sport: Sport; state: KmState; kf: Kf | null; last: Last };

let km: (Omit<KmMsg, 'kf'> & { kf: Kf | undefined }) | null = null;

/** Stand aus der Web-App (nur übernehmen, wenn er nicht älter ist als der hier weitergezählte) */
export function setKm(m: KmMsg) {
  if (!m?.state || !m.last) return;
  if (km && km.last.time > m.last.time) return;
  km = { ...m, kf: m.kf ?? undefined };
}

/** Tour zu Ende */
export function clearKm() {
  km = null;
}

/** Punkt im Hintergrund (Bildschirm aus bzw. App nicht offen) */
export function kmBackground(l: Loc) {
  const k = km;
  if (!k || l.timestamp <= k.last.time) return;
  const fix = { lat: l.coords.latitude, lng: l.coords.longitude, time: l.timestamp, accuracy: l.coords.accuracy, speed: speedForFilter(l.coords.speed, null) };
  const st = trackStep(k.kf, k.last, fix, k.sport);
  if (!st) return;
  k.kf = st.kf;
  if (!st.at) return;
  const point = { lat: st.at.lat, lng: st.at.lng, time: l.timestamp };
  const r = kmStep(k.state, k.last, point, st.moved);
  k.state = r.s;
  k.last = point;
  if (r.say && k.on) sayInBackground(k.en ? r.say.en : r.say.de, k.en);
}
