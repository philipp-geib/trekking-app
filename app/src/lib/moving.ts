// Zeit in Bewegung für ein Stück der Aufzeichnung – gemeinsam für tourStats (ganze Tour) und kmVoice (laufend, auch in der App-Hülle bei
// gesperrtem Bildschirm). Nur geo als Abhängigkeit (die Hülle bindet die Datei direkt ein).
import { distance } from './geo';

/** Länger als so ohne nennenswerte Bewegung = Pause (Nutzer: Ampel, kurz stehen – ab 5 s raus). Punkte kommen nur, wenn man sich ≥ 3 m bewegt. */
export const PAUSE_GAP = 5_000;
/** Langsamstes Tempo, das noch als Bewegung zählt (m/s, ≈ 0,9 km/h). */
export const MIN_SPEED = 0.25;
/** Tempo über einem GPS-Sprung zählt nicht als Bezug (m/s). */
const MAX_REF = 30;

type P = { lat: number; lng: number; time: number; seg?: boolean };

/** Bezugstempo = gleitender Schnitt über etwa so lange (ms). Früher nur das letzte Stück → GPS-Zittern (Wald, 10–20 m Genauigkeit)
 * hob den Bezug, das nächste normale Stück galt als „halb so schnell“ = Pause → Bewegungszeit 10–20 % zu kurz, Ø zu hoch (Nutzer 27.11.: 5,7 statt ~4,9 km/h). */
const REF_WINDOW = 30_000;

/**
 * Bewegungszeit (ms) von a nach b. Lücke > 5 s unter halbem Bezugstempo (`ref`, m/s, gleitender Schnitt) zählt nur mit diesem Tempo,
 * der Rest ist Pause; gleichmäßig langsam (steil bergauf) bleibt Bewegung. Gibt den neuen Bezug mit zurück.
 */
export function movingStep(a: P, b: P, ref: number): { ms: number; ref: number } {
  const dt = b.time - a.time;
  if (b.seg || dt <= 0) return { ms: 0, ref };
  const d = distance(a, b);
  const v = d / (dt / 1000);
  // am Anfang (Bezug noch Mindesttempo) gleich das erste Tempo nehmen
  const mix = () => (v > MAX_REF ? ref : Math.max(MIN_SPEED, ref <= MIN_SPEED ? v : ref + (v - ref) * Math.min(1, dt / REF_WINDOW)));
  if (dt <= PAUSE_GAP || v >= ref / 3) return { ms: dt, ref: mix() };
  return { ms: (d / ref) * 1000, ref };
}
