// Sportart einer Route bzw. Tour (wie Komoot): bestimmt das BRouter-Profil beim Planen und die geschätzte Zeit.
// Skiabfahrt: Höhenmeter bergauf zählen als Lift.
import { HIKING, hikingTime } from './hiking';

export type Sport = 'wandern' | 'bergwandern' | 'klettersteig' | 'laufen' | 'rad' | 'mtb' | 'rennrad' | 'skitour' | 'ski' | 'telemark' | 'schneeschuh' | 'langlauf';

type Info = {
  label: string;
  /** Material Design Icon */
  icon: string;
  /** BRouter-Profile, der Reihe nach probiert (falls eines auf dem Server fehlt) */
  profiles: string[];
  /** Fahrrad/Laufen: km/h in der Ebene und Höhenmeter je Stunde bergauf */
  kmh?: number;
  upPerHour?: number;
  /** Zu-Fuß-Sportarten: Faktor auf das DIN-Tempo (Klettersteig: Sichern kostet Zeit) */
  pace?: number;
};

// Eigene BRouter-Profile (app/public/routing, Kopie der Standard-Profile mit milderen Kosten für große Straßen – Nutzer 21.11.:
// lieber direkt auf der Hauptstraße als Umwege; die Farbe der Wegeart zeigt den Verkehr). planner.ts lädt sie bei Bedarf hoch,
// klappt das nicht, gilt das Standard-Profil dahinter.
const FOOT = 'custom_trekking-fuss-1';
const BIKE = 'custom_trekking-rad-1';

export const SPORTS: Record<Sport, Info> = {
  wandern: { label: 'Wandern', icon: 'hiking', profiles: [FOOT, 'hiking-mountain'] },
  // wie Wandern, Schwerpunkt alpine Wege (SAC, Hütten, Gewitter am Nachmittag)
  bergwandern: { label: 'Bergwandern', icon: 'image-filter-hdr', profiles: [FOOT, 'hiking-mountain'] },
  // wie Wandern, langsamer (Seil, Sichern, Stau am Steig); Ausrüstung + Gewitter im Vordergrund
  klettersteig: { label: 'Klettersteig', icon: 'carabiner', profiles: [FOOT, 'hiking-mountain'], pace: 0.75 },
  laufen: { label: 'Laufen', icon: 'run', profiles: [FOOT, 'hiking-mountain'], kmh: 9, upPerHour: 700 },
  rad: { label: 'Radfahren', icon: 'bike', profiles: [BIKE, 'trekking'], kmh: 16, upPerHour: 600 },
  mtb: { label: 'Mountainbike', icon: 'bicycle', profiles: ['mtb-zossebart', BIKE, 'trekking'], kmh: 12, upPerHour: 450 },
  // Rennrad: Asphalt; große Straßen erlaubt (Nutzer 21.11.: Verkehr meiden machte in der Stadt große Umwege)
  rennrad: { label: 'Rennrad', icon: 'bike-fast', profiles: ['fastbike'], kmh: 25, upPerHour: 900 },
  // BRouter kennt keine Skirouten → Bergwander-Profil (für Pisten/freies Gelände lieber Off-Grid)
  skitour: { label: 'Skitour', icon: 'snowflake', profiles: [FOOT, 'hiking-mountain'], kmh: 5, upPerHour: 400 },
  ski: { label: 'Skiabfahrt', icon: 'ski', profiles: [FOOT, 'hiking-mountain'], kmh: 25, upPerHour: 2000 },
  // Telemark: freie Ferse, Kniebeuge im Schwung; meist Piste/Lift, oft auch mit Fellen bergauf
  telemark: { label: 'Telemark', icon: 'ski', profiles: [FOOT, 'hiking-mountain'], kmh: 20, upPerHour: 1500 },
  // Schneeschuh (Nutzer 25.11.): zu Fuß im Schnee – Wander-Profil, DIN-Zeit langsamer (Spuren, Tiefschnee); immer mit Lawinenlagebericht
  schneeschuh: { label: 'Schneeschuh', icon: 'snowshoe', profiles: [FOOT, 'hiking-mountain'], pace: 0.7 },
  // Skilanglauf (Nutzer 25.11.): auf Loipen (lib/loipen.ts, Weg = Loipe aus OSM); BRouter nur für Stücke abseits der Loipe
  langlauf: { label: 'Langlauf', icon: 'ski', profiles: [FOOT, 'hiking-mountain'], kmh: 10, upPerHour: 450 },
};

/** Zu Fuß am Berg (Wandern-Verwandte): DIN-Zeit, nasse Wege, Trittsicherheit */
export const HIKE_SPORTS: Sport[] = ['wandern', 'bergwandern', 'klettersteig'];
export const isHike = (s?: Sport) => !!s && HIKE_SPORTS.includes(s);

/** Schnee-Sportarten: Hangneigung, Lawinenlage */
export const SNOW_SPORTS: Sport[] = ['skitour', 'ski', 'telemark', 'schneeschuh'];
export const isSnow = (s?: Sport) => !!s && SNOW_SPORTS.includes(s);
/** Ski-Sportarten (mit `WINTER` ausgeblendet) – Schneeschuh bleibt wählbar */
export const SKI_SPORTS: Sport[] = ['skitour', 'ski', 'telemark'];

export const SPORT_IDS = Object.keys(SPORTS) as Sport[];

/** Wintersport (Skitour, Skiabfahrt, Telemark, Skigebiet, Hangneigung) vorerst ausgeblendet (Nutzer, 20.11.) – Code bleibt. */
export const WINTER = false;
/** Wählbare Sportarten (Auswahl, KI, geführter Plan) */
export const PICK_SPORTS: Sport[] = SPORT_IDS.filter((s) => WINTER || !SKI_SPORTS.includes(s));
/** Lawinenlagebericht immer (nicht erst, wenn Schnee liegen könnte): wählbare Schnee-Sportarten (Schneeschuh, mit WINTER auch Ski) */
export const avalancheAlways = (s?: Sport) => isSnow(s) && PICK_SPORTS.includes(s!);
/** Zuletzt gewählte Sportart – ausgeblendete zählen als Wandern */
export const pickedSport = (x?: { sport?: Sport } | null): Sport => {
  const s = sportOf(x);
  return PICK_SPORTS.includes(s) ? s : 'wandern';
};
/** Langlauf: Loipen auf der Karte, Loipe wählen (Planer + Navigation), Winterkarte – unabhängig von `WINTER` (Nutzer 25.11.) */
export const isNordic = (s?: Sport) => s === 'langlauf';
/** Zu Fuß (Lawinenlagebericht nur, wenn auf der Route Schnee liegen könnte) */
export const isFoot = (s?: Sport) => isHike(s) || s === 'laufen' || s === 'schneeschuh';

/** Tempo als Pace (min/km) statt km/h – Laufen und Gehen (Nutzer 22./23.11.); Klettersteig nicht (Strecke sagt dort wenig) */
export const usesPace = (s?: Sport) => s === 'wandern' || s === 'bergwandern' || s === 'laufen' || s === 'schneeschuh';
/** Zurückgelegte Strecke: „Gelaufen“ zu Fuß, sonst „Gefahren“ (Nutzer 23.11.: beim Rad stand „Gelaufen“) */
export const movedWord = (s?: Sport) => (isFoot(s) || s === 'skitour' || s === 'langlauf' ? 'Gelaufen' : 'Gefahren');
/** Geschätzte Zeit: „Gehzeit“ / „Laufzeit“ / „Fahrzeit“ */
export const timeWord = (s?: Sport) => (s === 'laufen' || s === 'langlauf' ? 'Laufzeit' : isFoot(s) || s === 'skitour' ? 'Gehzeit' : 'Fahrzeit');
/** Fahrrad-Sportarten (Wattmesser, Trittfrequenz) */
export const isBike = (s?: Sport) => s === 'rad' || s === 'mtb' || s === 'rennrad';

export const sportOf = (x?: { sport?: Sport } | null): Sport => (x?.sport && SPORTS[x.sport] ? x.sport : 'wandern');

/** Geschätzte Zeit in ms: Wandern nach DIN 33466, sonst Strecke / Tempo + Höhenmeter / Steigleistung. */
export function moveTime(sport: Sport, meters: number, up: number, down: number, pace = 1): number {
  const s = SPORTS[sport] ?? SPORTS.wandern;
  if (!s.kmh) return hikingTime(meters, up, down, pace * (s.pace ?? 1));
  const hours = meters / 1000 / s.kmh + up / (s.upPerHour ?? 600);
  return (hours / pace) * 3600000;
}

// Eigenes Ø-Tempo je Sportart (Nutzer: statt „gemütlich … sportlich“ ein Regler in km/h, z. B. Rennrad 30 km/h).
// Gilt in der Ebene; Anstiege/Abstiege rechnet die Formel dazu (Steigleistung wächst im selben Verhältnis).
export type Speeds = Partial<Record<Sport, number>>;
type PaceSet = { pace?: number; speeds?: Speeds };

/** Standard-Tempo in der Ebene (km/h): Wandern DIN 4 km/h (Klettersteig ×0,75), sonst `kmh` */
export const flatKmh = (sport: Sport) => {
  const s = SPORTS[sport] ?? SPORTS.wandern;
  return s.kmh ?? HIKING.kmPerHour * (s.pace ?? 1);
};

/** Regler: [min, max, Schritt] in km/h */
export const SPEED_RANGE: Record<Sport, [number, number, number]> = {
  wandern: [2, 7, 0.1],
  bergwandern: [2, 7, 0.1],
  klettersteig: [1.5, 5, 0.1],
  laufen: [5, 18, 0.5],
  rad: [8, 50, 0.5],
  mtb: [6, 28, 0.5],
  rennrad: [15, 50, 0.5],
  skitour: [2, 10, 0.5],
  ski: [10, 50, 1],
  telemark: [10, 40, 1],
  schneeschuh: [1.5, 5, 0.1],
  langlauf: [4, 30, 0.5],
};

const snap = (sport: Sport, v: number) => {
  const [min, max, step] = SPEED_RANGE[sport];
  return Math.min(max, Math.max(min, Math.round(Math.round(v / step) * step * 10) / 10));
};

/** Eingestelltes Ø-Tempo (km/h) – ohne eigene Angabe Standard × altes Tempo-Faktor */
export const speedOf = (set: PaceSet, sport: Sport) => set.speeds?.[sport] ?? snap(sport, flatKmh(sport) * (set.pace ?? 1));

/** Faktor auf die Standardzeit (für `moveTime`, Fortschritt, Coach) */
export const paceOf = (set: PaceSet, sport: Sport) => {
  const v = set.speeds?.[sport];
  return v ? v / flatKmh(sport) : set.pace ?? 1;
};

/** „4,5 km/h“ / „30 km/h“ */
export const kmhText = (v: number) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km/h`;

// Satz im Feed statt Tourname: „Lena war wandern“ / „Du warst wandern“ (Nutzer: schlicht; Sportart steckt im Satz). [3. Person, 2. Person]
const DID: Record<Sport, [string, string]> = {
  wandern: ['war wandern', 'warst wandern'],
  bergwandern: ['war bergwandern', 'warst bergwandern'],
  klettersteig: ['war am Klettersteig', 'warst am Klettersteig'],
  laufen: ['war laufen', 'warst laufen'],
  rad: ['war radeln', 'warst radeln'],
  mtb: ['war mountainbiken', 'warst mountainbiken'],
  rennrad: ['war Rennrad fahren', 'warst Rennrad fahren'],
  skitour: ['war auf Skitour', 'warst auf Skitour'],
  ski: ['war Ski fahren', 'warst Ski fahren'],
  telemark: ['war Telemark fahren', 'warst Telemark fahren'],
  schneeschuh: ['war schneeschuhwandern', 'warst schneeschuhwandern'],
  langlauf: ['war langlaufen', 'warst langlaufen'],
};

/** Satzende nach dem Namen: you = „Du …“ */
export function didSport(s: Sport, you: boolean): string {
  const d = DID[s] ?? DID.wandern;
  return you ? d[1] : d[0];
}
