// Sprachansagen der Navigation in Deutsch und Englisch (Nutzer 23.11.): ganze Sätze je Sprache statt Wort-für-Wort-Übersetzung
// über en.json (die machte aus „Jetzt links abbiegen.“ „Now lTurn inks.“). Rein → testbar (spoken.test.ts).
import type { Guide, Side, TurnKind } from './turns';

export type Spoken = { de: string; en: string };

const round = (m: number) => (m >= 1000 ? Math.round(m / 100) * 100 : m >= 200 ? Math.round(m / 50) * 50 : Math.round(m / 10) * 10);

/** „300 Metern“ (nach „In“) bzw. „300 Meter“; englisch „300 metres“ */
export function spokenDist(m: number, en: boolean, dative = true): string {
  const r = round(Math.max(0, m));
  if (r >= 1000) {
    const k = r / 1000;
    if (en) return `${k} ${k === 1 ? 'kilometre' : 'kilometres'}`;
    return `${String(k).replace('.', ',')} ${dative && k !== 1 ? 'Kilometern' : 'Kilometer'}`;
  }
  return en ? `${r} metres` : `${r} ${dative ? 'Metern' : 'Meter'}`;
}

const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const SIDE_DE: Record<Side, string> = { left: 'links', right: 'rechts' };

/** Abbiege-Satzteil klein, z. B. „links abbiegen“ / „turn left“, „2. Abzweigung rechts“ / „take the 2nd right“ */
export function turnPhrase(kind: TurnKind, side: Side | undefined, ordinal: number | undefined, en: boolean): string {
  const s = side ? (en ? side : SIDE_DE[side]) : '';
  const n = ordinal && ordinal > 1 ? ordinal : 0;
  if (en) {
    switch (kind) {
      case 'slight': return n ? `take the ${ord(n)} slight ${s}` : `keep slightly ${s}`;
      case 'turn': return n ? `take the ${ord(n)} ${s}` : `turn ${s}`;
      case 'sharp': return n ? `take the ${ord(n)} sharp ${s}` : `turn sharp ${s}`;
      case 'uturn': return 'make a U-turn';
      case 'curve': return `follow the sharp ${side === 'right' ? 'right' : 'left'} bend`;
      default: return 'continue straight ahead';
    }
  }
  const pre = n ? `${n}. Abzweigung ` : '';
  switch (kind) {
    case 'slight': return pre ? `${pre}leicht ${s}` : `leicht ${s} halten`;
    case 'turn': return pre ? `${pre}${s}` : `${s} abbiegen`;
    case 'sharp': return pre ? `${pre}scharf ${s}` : `scharf ${s} abbiegen`;
    case 'uturn': return 'wenden';
    case 'curve': return side === 'right' ? 'scharfe Rechtskurve' : 'scharfe Linkskurve';
    default: return 'geradeaus';
  }
}

const both = (f: (en: boolean) => string): Spoken => ({ de: f(false), en: f(true) });

/** Abbiegen: `dist` null = jetzt */
export const sayTurn = (g: Pick<Guide, 'kind' | 'side' | 'ordinal'>, dist: number | null): Spoken =>
  both((en) => {
    const p = turnPhrase(g.kind, g.side, g.ordinal, en);
    if (dist == null) return en ? `Now ${p}.` : `Jetzt ${p}.`;
    return en ? `In ${spokenDist(dist, en)}, ${p}.` : `In ${spokenDist(dist, en)} ${p}.`;
  });

export const sayFinish = (dist: number | null): Spoken =>
  dist == null
    ? { de: 'Du hast dein Ziel erreicht.', en: 'You have reached your destination.' }
    : both((en) => (en ? `In ${spokenDist(dist, en)}, you will reach your destination.` : `In ${spokenDist(dist, en)} erreichst du dein Ziel.`));

/** Anstieg voraus: Nummer i von n, Länge m, Höhenmeter, Ø % */
export const sayClimbSoon = (dist: number, i: number, n: number, length: number, gain: number, grade: number): Spoken =>
  both((en) =>
    en
      ? `In ${spokenDist(dist, en)}, climb ${i} of ${n} begins: ${spokenDist(length, en)}, ${Math.round(gain)} metres of climbing, averaging ${Math.round(grade)} percent.`
      : `In ${spokenDist(dist, en)} beginnt Anstieg ${i} von ${n}: ${spokenDist(length, en, false)}, ${Math.round(gain)} Höhenmeter, im Schnitt ${Math.round(grade)} Prozent.`,
  );

export const sayClimbStart = (i: number, n: number, gain: number): Spoken => ({
  de: `Anstieg ${i} von ${n} beginnt. ${Math.round(gain)} Höhenmeter.`,
  en: `Climb ${i} of ${n} begins. ${Math.round(gain)} metres of climbing.`,
});

export const sayClimbTop = (rest: number): Spoken =>
  both((en) => (en ? `${spokenDist(rest, en)} to the top of the climb.` : `Noch ${spokenDist(rest, en, false)} bis zum Ende des Anstiegs.`));

/** Tour verlassen (Titel aus alertText, englisch übersetzt mitgegeben) */
export const sayOff = (title: Spoken, dist: number): Spoken =>
  both((en) => (en ? `${title.en}. ${spokenDist(dist, en)} off the tour.` : `${title.de}. ${spokenDist(dist, en, false)} neben der Tour.`));

/** Pace gesprochen: „5 Minuten 12“ / „5 minutes 12“ */
function spokenPace(msPerKm: number, en: boolean): string {
  let m = Math.floor(msPerKm / 60000), sec = Math.round((msPerKm % 60000) / 1000);
  if (sec === 60) { m++; sec = 0; }
  const min = en ? (m === 1 ? 'minute' : 'minutes') : m === 1 ? 'Minute' : 'Minuten';
  return sec ? `${m} ${min} ${sec}` : `${m} ${min}`;
}

/** Kilometer-Ansage (Laufen/Gehen): „3 Kilometer. Letzter Kilometer 5 Minuten 12. Schnitt 5 Minuten 20.“ */
export const sayKm = (km: number, lastMs: number, avgMs: number): Spoken =>
  both((en) => {
    const head = en ? `${km} ${km === 1 ? 'kilometre' : 'kilometres'}.` : `${km} Kilometer.`;
    if (!(lastMs > 0) || lastMs >= 3600000) return head;
    const last = en ? ` Last kilometre ${spokenPace(lastMs, en)}.` : ` Letzter Kilometer ${spokenPace(lastMs, en)}.`;
    const avg = km > 1 && avgMs > 0 && avgMs < 3600000 ? (en ? ` Average ${spokenPace(avgMs, en)}.` : ` Schnitt ${spokenPace(avgMs, en)}.`) : '';
    return head + last + avg;
  });

export const SAY = {
  back: { de: 'Zurück auf der Tour.', en: 'Back on the tour.' },
  rejoin: { de: 'Weg zurück zur Tour berechnet.', en: 'Found a way back to the tour.' },
  voiceOn: { de: 'Sprachansagen an.', en: 'Voice guidance on.' },
  sample: { de: 'In 300 Metern rechts abbiegen.', en: 'In 300 metres, turn right.' },
} satisfies Record<string, Spoken>;
