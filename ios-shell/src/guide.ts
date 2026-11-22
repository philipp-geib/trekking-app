// Sprachansagen bei gesperrtem Bildschirm: dieselbe Rechnung wie die Web-App (app/src/lib/turns.ts, ohne Kartenwege =
// Knicke ≥ 55°), dazu „Tour verlassen“/„zurück“ und Ziel. Im Vordergrund sagt die Web-App an (über sayFromPage, gleiche Stimme) – hier nur im Hintergrund.
// Dieselbe Rechnung füllt die Live-Aktivität auf dem Sperrbildschirm (src/activity.ts, nur iPhone), auch ohne Ansagen.
import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { matchRoute, type LatLng } from '../../app/src/lib/geo';
import { findBends, nextGuide, sampleRoute, type Bend, type Guide, type Samples } from '../../app/src/lib/turns';
import { activityGuide, activityOff, activityRecording, activityStop } from './activity';
import type { Loc } from './location';

export type NavMsg = {
  on: boolean;
  voice?: boolean;
  /** gewählte Stimme (expo-speech identifier, = voiceURI in Safari) */
  voiceId?: string;
  lang?: 'de' | 'en';
  sport?: string;
  /** Start der Aufzeichnung (ms) */
  startedAt?: number;
  route?: { id: string; points: [number, number][]; cumulative: number[]; length: number } | null;
};

type Nav = { id: string; points: LatLng[]; cumulative: number[]; length: number; samples: Samples; bends: Bend[]; voice: boolean; en: boolean; fast: boolean };

let voiceId: string | undefined;

const FAST = ['rad', 'mtb', 'rennrad', 'ski', 'telemark'];
let nav: Nav | null = null;
const said = new Set<string>();
let off = false;
let lastAlong: number | undefined;

export function setNav(m: NavMsg) {
  voiceId = m.voiceId;
  if (!m.on) {
    nav = null;
    activityStop();
    return;
  }
  if (!m.route || m.route.points.length < 2) {
    nav = null;
    activityRecording(m.startedAt ?? Date.now(), m.lang === 'en');
    return;
  }
  if (nav?.id === m.route.id) {
    nav.voice = m.voice !== false;
    nav.en = m.lang === 'en';
    nav.fast = FAST.includes(m.sport ?? '');
    return;
  }
  const points = m.route.points.map(([lat, lng]) => ({ lat, lng }));
  const samples = sampleRoute(points, m.route.cumulative);
  nav = { id: m.route.id, points, cumulative: m.route.cumulative, length: m.route.length, samples, bends: findBends(samples), voice: m.voice !== false, en: m.lang === 'en', fast: FAST.includes(m.sport ?? '') };
  said.clear();
  off = false;
  lastAlong = undefined;
  activityGuide(nextGuide(samples, nav.bends, [], 0, nav.length), '', 0, nav.length, 0, nav.en);
  audio();
}

let audioSet = false;
/** Ansagen auch im Lautlos-Modus und im Hintergrund, Musik wird leiser */
function audio() {
  if (audioSet) return;
  audioSet = true;
  void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'duckOthers', allowsRecording: false, shouldRouteThroughEarpiece: false }).catch(() => {
    audioSet = false;
  });
}

// Musik (Spotify …) nur während der Ansage leiser: danach Audio-Sitzung freigeben, sonst bleibt sie die ganze Tour gedimmt.
let talking = 0;
let release: ReturnType<typeof setTimeout> | undefined;
function utter(text: string, language: string, voice: string | undefined) {
  clearTimeout(release);
  talking++;
  void setIsAudioActiveAsync(true).catch(() => undefined);
  const done = () => {
    talking = Math.max(0, talking - 1);
    if (talking) return;
    release = setTimeout(() => void setIsAudioActiveAsync(false).catch(() => undefined), 400);
  };
  Speech.speak(text, { language, voice, rate: 1, onDone: done, onStopped: done, onError: done });
}

function say(text: string, en: boolean) {
  utter(text, en ? 'en-GB' : 'de-DE', voiceId);
}

/** Ansage der Web-App im Vordergrund (src/lib/voice.ts: {type:'say'}). */
export function sayFromPage(text: string, language: string, voice: string | undefined, urgent: boolean) {
  audio();
  if (urgent) {
    void Speech.stop();
    talking = 0;
  }
  utter(text, language, voice);
}

export function hush() {
  void Speech.stop();
  talking = 0;
  release = setTimeout(() => void setIsAudioActiveAsync(false).catch(() => undefined), 400);
}

/** Stimmen des Geräts für die Auswahl (Profil → Design) */
export async function deviceVoices() {
  const all = await Speech.getAvailableVoicesAsync().catch(() => []);
  return all.map((v) => ({ id: v.identifier, name: v.name, lang: v.language, quality: String(v.quality) }));
}

const meters = (m: number, en: boolean) => {
  const r = m >= 1000 ? Math.round(m / 100) / 10 : m >= 200 ? Math.round(m / 50) * 50 : Math.round(m / 10) * 10;
  if (r >= 1000) return en ? `${r / 1000} kilometres` : `${String(r / 1000).replace('.', ',')} Kilometern`;
  return en ? `${r} metres` : `${r} Metern`;
};

function phrase(g: Guide, en: boolean): string {
  const right = g.side === 'right';
  const nth = g.ordinal && g.ordinal > 1 ? g.ordinal : 0;
  if (en) {
    const side = right ? 'right' : 'left';
    const pre = nth ? `take the ${nth}${nth === 2 ? 'nd' : nth === 3 ? 'rd' : 'th'} turn ` : 'turn ';
    switch (g.kind) {
      case 'slight': return `keep slightly ${side}`;
      case 'sharp': return `${pre}sharp ${side}`;
      case 'uturn': return 'turn around';
      case 'curve': return `sharp ${side} bend`;
      default: return `${pre}${side}`;
    }
  }
  const side = right ? 'rechts' : 'links';
  const pre = nth ? `${nth}. Abzweigung ` : '';
  switch (g.kind) {
    case 'slight': return `leicht ${side} halten`;
    case 'sharp': return pre ? `${pre}scharf ${side}` : `scharf ${side} abbiegen`;
    case 'uturn': return 'wenden';
    case 'curve': return right ? 'scharfe Rechtskurve' : 'scharfe Linkskurve';
    default: return pre ? `${pre}${side}` : `${side} abbiegen`;
  }
}

/** Neuer Standort. `background` = Bildschirm aus bzw. App nicht offen → selbst ansagen. */
export function guideStep(l: Loc, background: boolean) {
  const n = nav;
  if (!n) return;
  const speak = background && n.voice;
  const pos = { lat: l.coords.latitude, lng: l.coords.longitude };
  const m = matchRoute(pos, n.points, n.cumulative, lastAlong);
  if (!m) return;
  lastAlong = m.along;
  const en = n.en;
  const once = (key: string, text: string) => {
    if (said.has(key)) return;
    said.add(key);
    if (speak) say(text, en);
  };

  // Tour verlassen / zurück (mit Abstand dazwischen, damit es nicht hin und her springt)
  if (!off && m.distance > 60 && (l.coords.accuracy ?? 0) < 50) {
    off = true;
    activityOff(m.distance, m.along, n.length, en);
    if (speak) say(en ? `You have left the tour. ${meters(m.distance, en)} away.` : `Du hast die Tour verlassen. ${meters(m.distance, en)} daneben.`.replace('Metern daneben', 'Meter daneben').replace('Kilometern daneben', 'Kilometer daneben'), en);
    return;
  }
  if (off && m.distance < 30) {
    off = false;
    if (speak) say(en ? 'Back on the tour.' : 'Zurück auf der Tour.', en);
  }
  if (off) return activityOff(m.distance, m.along, n.length, en);

  const g = nextGuide(n.samples, n.bends, [], m.along, n.length);
  const far = n.fast ? 300 : 120, near = n.fast ? 60 : 25;
  activityGuide(g, phrase(g, en), m.along, n.length, near, en);
  const key = `${n.id}:${Math.round(g.along)}`;
  if (g.kind === 'finish') {
    if (g.dist <= near) once(`${key}:ziel`, en ? 'You have reached your destination.' : 'Du hast dein Ziel erreicht.');
    else if (g.dist <= far && g.dist > near * 2) once(`${key}:far`, en ? `In ${meters(g.dist, en)} you reach your destination.` : `In ${meters(g.dist, en)} erreichst du dein Ziel.`);
  } else if (g.kind !== 'straight') {
    const p = phrase(g, en);
    if (g.dist <= near) once(`${key}:near`, en ? `Now ${p}.` : `Jetzt ${p}.`);
    else if (g.dist <= far && g.dist > near * 2) once(`${key}:far`, `In ${meters(g.dist, en)} ${p}.`);
  }
}
