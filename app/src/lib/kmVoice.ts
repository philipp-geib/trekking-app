// Kilometer-Ansage zu Fuß (Nutzer 23.11.: wie Strava/Komoot – nach jedem Kilometer Pace des letzten und Ø-Pace).
// Läuft schrittweise mit jedem neuen Punkt der Aufzeichnung (lib/tracking.ts) und genauso in der App-Hülle bei gesperrtem Bildschirm
// (ios-shell/src/km.ts) – gleiche Rechnung, gleicher Stand → Ansage an derselben Stelle, egal wer gerade spricht. Nur reine Abhängigkeiten.
import { MIN_SPEED, movingStep } from './moving';
import { sayKm, type Spoken } from './spoken';

type P = { lat: number; lng: number; time: number; seg?: boolean };

/** n = fertige Kilometer, d = m im laufenden, ms = Bewegungszeit im laufenden, sum = Bewegungszeit der fertigen, ref = Bezugstempo (moving.ts) */
export type KmState = { n: number; d: number; ms: number; sum: number; ref: number };

export const KM_START: KmState = { n: 0, d: 0, ms: 0, sum: 0, ref: MIN_SPEED };

/** Neuer Punkt `b` nach `a`, `moved` = gezählte Strecke (m, wie tour.distance). Gibt den neuen Stand und ggf. die Ansage zurück. */
export function kmStep(s: KmState, a: P | undefined, b: P, moved: number): { s: KmState; say: Spoken | null } {
  if (!a || b.seg || !(moved > 0)) return { s, say: null };
  const step = movingStep(a, b, s.ref);
  let { n, d, ms, sum } = s;
  let left = moved, lms = step.ms, lastKm = 0;
  while (d + left >= 1000) {
    const part = 1000 - d;
    const pms = lms * (part / left);
    lastKm = ms + pms;
    sum += lastKm;
    n++;
    lms -= pms;
    left -= part;
    d = 0;
    ms = 0;
  }
  d += left;
  ms += lms;
  const next = { n, d, ms, sum, ref: step.ref };
  return { s: next, say: n > s.n ? sayKm(n, lastKm, sum / n) : null };
}
