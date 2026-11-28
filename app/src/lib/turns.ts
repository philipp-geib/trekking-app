// Abbiegehinweise aus der Routenlinie (für alle Routen, auch GPX): Knicke ≥ 25° werden zu Kandidaten.
// Mit Straßen/Wegen aus den Kartenkacheln (TrekMap.queryRoads, nur Browser) wird geprüft, ob dort eine Abzweigung ist:
// ja → „rechts abbiegen“, bei Abzweigungen davor auf derselben Seite „2. Abzweigung rechts“; nein → nur scharfe
// Kurven (≥ 100°) als „Scharfe Rechtskurve“/„Kehre“. Ohne Kacheln: Knicke ≥ 55° als Abbiegen (ohne Zählung).
import { bearing, distance, formatDistance, type LatLng } from './geo';

export type TurnKind = 'slight' | 'turn' | 'sharp' | 'uturn' | 'curve' | 'finish' | 'straight';
export type Side = 'left' | 'right';

/** Knick in der Route: `angle` mit Vorzeichen (+ = rechts) */
export type Bend = { along: number; angle: number; at: LatLng };
/** `ahead` = Weg geht (fast) geradeaus weiter, während die Route abbiegt */
export type Branch = { along: number; side: Side | 'ahead'; rel: number };

export type Guide = {
  kind: TurnKind;
  side?: Side;
  /** Abzweigung Nr. n auf dieser Seite (ab 2 angezeigt) */
  ordinal?: number;
  /** Strecke bis dahin (m) */
  dist: number;
  /** Stelle auf der Route (m) – Schlüssel für Ansagen */
  along: number;
  text: string;
  icon: string;
};

const STEP = 5;

/** Route alle 5 m (lokale Meter-Koordinaten für schnelle Abstände). */
export type Samples = { pts: LatLng[]; x: number[]; y: number[]; lat0: number };

export function sampleRoute(points: LatLng[], cumulative: number[]): Samples {
  const total = cumulative[cumulative.length - 1] ?? 0;
  const pts: LatLng[] = [];
  let k = 0;
  for (let d = 0; d <= total; d += STEP) {
    while (k < cumulative.length - 2 && cumulative[k + 1] < d) k++;
    const span = cumulative[k + 1] - cumulative[k];
    const t = span > 0 ? Math.max(0, Math.min(1, (d - cumulative[k]) / span)) : 0;
    const a = points[k], b = points[k + 1] ?? a;
    pts.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  const lat0 = pts[0]?.lat ?? 0;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return { pts, x: pts.map((p) => p.lng * kx), y: pts.map((p) => p.lat * 110540), lat0 };
}

const norm180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const at = (s: Samples, along: number) => s.pts[Math.max(0, Math.min(s.pts.length - 1, Math.round(along / STEP)))];
const headingAt = (s: Samples, from: number, to: number) => bearing(at(s, from), at(s, to));

/** Knicke der Route ≥ 25° (je Kurve der stärkste Punkt). */
export function findBends(s: Samples): Bend[] {
  const n = s.pts.length;
  const out: Bend[] = [];
  const W = 4; // 20 m
  let run: { i: number; v: number }[] = [];
  const flush = () => {
    if (!run.length) return;
    const peak = run.reduce((a, b) => (Math.abs(b.v) > Math.abs(a.v) ? b : a));
    const d = peak.i * STEP;
    // Gesamtwinkel der Kurve: Richtung 40…5 m davor gegen 5…40 m danach
    const angle = norm180(headingAt(s, d + 5, d + 40) - headingAt(s, d - 40, d - 5));
    if (Math.abs(angle) >= 25) out.push({ along: d, angle, at: s.pts[peak.i] });
    run = [];
  };
  for (let i = W; i < n - W; i++) {
    const v = norm180(bearing(s.pts[i], s.pts[i + W]) - bearing(s.pts[i - W], s.pts[i]));
    if (Math.abs(v) >= 20 && (!run.length || Math.sign(v) === Math.sign(run[0].v))) run.push({ i, v });
    else {
      flush();
      if (Math.abs(v) >= 20) run.push({ i, v });
    }
  }
  flush();
  // zu dicht beieinander (< 25 m, gleiche Richtung): stärkeren behalten
  const one = out.filter((b, i) => !out.some((o, j) => j !== i && Math.abs(o.along - b.along) < 25 && Math.sign(o.angle) === Math.sign(b.angle) && (Math.abs(o.angle) > Math.abs(b.angle) || (Math.abs(o.angle) === Math.abs(b.angle) && j < i))));
  // Kehre: zwei Knicke in dieselbe Richtung kurz hintereinander (< 60 m) = einer mit Summe
  const merged: Bend[] = [];
  for (const b of one) {
    const last = merged[merged.length - 1];
    if (last && b.along - last.along < 60 && Math.sign(b.angle) === Math.sign(last.angle)) {
      last.angle = Math.max(-180, Math.min(180, last.angle + b.angle));
    } else merged.push({ ...b });
  }
  return merged;
}

/**
 * Raster der Stichproben i0…i1 (Zellen 10 m): Suche „liegt ein Wegpunkt ≤ 6 m an der Route?“ prüft nur die Nachbarzellen
 * statt aller Stichproben (vorher je Wegpunkt alle bis zu 1000 Stichproben → Akku).
 */
const CELL = 10;
function sampleGrid(s: Samples, i0: number, i1: number) {
  const grid = new Map<number, number[]>();
  for (let i = Math.max(0, i0); i <= Math.min(s.pts.length - 1, i1); i++) {
    const k = cellKey(Math.floor(s.x[i] / CELL), Math.floor(s.y[i] / CELL));
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  }
  return grid;
}
const cellKey = (cx: number, cy: number) => cx * 1e7 + cy;

/** Wie `nearest` über i0…i1, aber nur für Abstände ≤ CELL genau (sonst d = Infinity). Gleichstand → kleinerer Index (wie nearest). */
function nearestIn(s: Samples, grid: Map<number, number[]>, x: number, y: number, i0: number, i1: number) {
  let best = Infinity, bi = -1;
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const list = grid.get(cellKey(cx + dx, cy + dy));
      if (!list) continue;
      for (const i of list) {
        if (i < i0 || i > i1) continue;
        const d = (s.x[i] - x) ** 2 + (s.y[i] - y) ** 2;
        if (d < best || (d === best && i < bi)) { best = d; bi = i; }
      }
    }
  return { d: Math.sqrt(best), i: bi };
}

/** Kürzester Abstand eines Punkts (lokale m) zu den Stichproben i0…i1 */
function nearest(s: Samples, x: number, y: number, i0: number, i1: number) {
  let best = Infinity, bi = -1;
  for (let i = Math.max(0, i0); i <= Math.min(s.pts.length - 1, i1); i++) {
    const d = (s.x[i] - x) ** 2 + (s.y[i] - y) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  return { d: Math.sqrt(best), i: bi };
}

/** Wegpunkt, der die Route (im Abschnitt) auf ≤ 6 m berührt – lokale m des ganzen Wegs + Stelle j */
type Touch = { lx: number[]; ly: number[]; j: number };

const windowOf = (s: Samples, from: number, to: number) => [Math.max(0, Math.floor(Math.max(0, from - 20) / STEP)), Math.min(s.pts.length - 1, Math.ceil((to + 20) / STEP))];

/** Alle Wegpunkte ≤ 6 m an den Stichproben i0…i1 (in Reihenfolge der Wege) */
function touchesOf(s: Samples, roads: LatLng[][], grid: Map<number, number[]>, i0: number, i1: number): Touch[] {
  const kx = 111320 * Math.cos((s.lat0 * Math.PI) / 180);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = i0; i <= i1; i++) {
    minX = Math.min(minX, s.x[i]); maxX = Math.max(maxX, s.x[i]); minY = Math.min(minY, s.y[i]); maxY = Math.max(maxY, s.y[i]);
  }
  const out: Touch[] = [];
  for (const line of roads) {
    // ganzer Weg außerhalb des Ausschnitts → überspringen, ohne ihn umzurechnen
    let inside = false;
    for (const p of line) {
      const x = p.lng * kx, y = p.lat * 110540;
      if (x >= minX - 8 && x <= maxX + 8 && y >= minY - 8 && y <= maxY + 8) { inside = true; break; }
    }
    if (!inside) continue;
    const lx = line.map((p) => p.lng * kx), ly = line.map((p) => p.lat * 110540);
    for (let j = 0; j < line.length; j++) {
      if (lx[j] < minX - 8 || lx[j] > maxX + 8 || ly[j] < minY - 8 || ly[j] > maxY + 8) continue;
      if (nearestIn(s, grid, lx[j], ly[j], i0, i1).d <= 6) out.push({ lx, ly, j });
    }
  }
  return out;
}

/** Abzweigungen an einem Berührpunkt (Route bei Stichprobe `hi`): 25 m den Weg entlang in beide Richtungen */
function branchesAt(s: Samples, t: Touch, hi: number): Branch[] {
  const { lx, ly, j } = t;
  const along = hi * STEP;
  const out: Branch[] = [];
  for (const dir of [-1, 1]) {
    let walked = 0, k = j, qx = lx[j], qy = ly[j];
    while (walked < 25) {
      const n = k + dir;
      if (n < 0 || n >= lx.length) break;
      const seg = Math.hypot(lx[n] - lx[k], ly[n] - ly[k]);
      if (walked + seg >= 25) {
        const t = (25 - walked) / seg;
        qx = lx[k] + (lx[n] - lx[k]) * t;
        qy = ly[k] + (ly[n] - ly[k]) * t;
        walked = 25;
        break;
      }
      walked += seg;
      k = n;
      qx = lx[k];
      qy = ly[k];
    }
    if (walked < 12) continue;
    if (nearest(s, qx, qy, hi - 14, hi + 14).d <= 10) continue; // läuft mit der Route
    const dirDeg = (Math.atan2(qx - lx[j], qy - ly[j]) * 180) / Math.PI;
    const rel = norm180(dirDeg - headingAt(s, along - 20, along));
    if (Math.abs(rel) > 165) continue;
    out.push({ along, side: Math.abs(rel) < 20 ? 'ahead' : rel > 0 ? 'right' : 'left', rel });
  }
  return out;
}

/** Abzweigungen der Berührpunkte, deren nächste Stichprobe in `from`…`to` liegt (sortiert, noch mit Doppelten) */
function collect(s: Samples, touches: Touch[], grid: Map<number, number[]>, from: number, to: number, memo?: Map<Touch, Map<number, Branch[]>>): Branch[] {
  const [i0, i1] = windowOf(s, from, to);
  const out: Branch[] = [];
  for (const t of touches) {
    const hit = nearestIn(s, grid, t.lx[t.j], t.ly[t.j], i0, i1);
    if (hit.d > 6) continue;
    const along = hit.i * STEP;
    if (along < from || along > to) continue;
    let m = memo?.get(t), b = m?.get(hit.i);
    if (!b) {
      b = branchesAt(s, t, hit.i);
      if (memo) {
        if (!m) memo.set(t, (m = new Map()));
        m.set(hit.i, b);
      }
    }
    out.push(...b);
  }
  return out.sort((a, b) => a.along - b.along);
}

/** gleiche Abzweigung aus mehreren Kacheln/Linien nur einmal */
const once = (out: Branch[]) => out.filter((b, i) => !out.slice(0, i).some((o) => o.side === b.side && Math.abs(o.along - b.along) < 12));

/**
 * Abzweigungen zwischen `from` und `to` (m auf der Route): Wege aus den Kacheln, die die Route an einem Punkt berühren
 * und sich dann von ihr entfernen. `rel` = Richtung gegenüber der Fahrtrichtung (+ = rechts).
 */
export function findBranches(s: Samples, roads: LatLng[][], from: number, to: number): Branch[] {
  const [i0, i1] = windowOf(s, from, to);
  const grid = sampleGrid(s, i0, i1);
  return once(collect(s, touchesOf(s, roads, grid, i0, i1), grid, from, to));
}

/** Gibt es Wege aus den Kacheln rund um diesen Punkt (Daten vorhanden)? */
export function roadsCover(roads: LatLng[][], p: LatLng, r = 250) {
  for (const line of roads) for (const q of line) if (Math.abs(q.lat - p.lat) < 0.004 && Math.abs(q.lng - p.lng) < 0.006 && distance(p, q) < r) return true;
  return false;
}

const SIDE = { left: 'links', right: 'rechts' } as const;

function icon(kind: TurnKind, side?: Side) {
  const r = side === 'right';
  switch (kind) {
    case 'slight': return r ? 'arrow-top-right' : 'arrow-top-left';
    case 'turn': return r ? 'arrow-right-top' : 'arrow-left-top';
    case 'sharp': return r ? 'arrow-bottom-right' : 'arrow-bottom-left';
    case 'uturn': return r ? 'arrow-u-down-right' : 'arrow-u-down-left';
    case 'curve': return r ? 'arrow-u-right-top' : 'arrow-u-left-top';
    case 'finish': return 'flag-checkered';
    default: return 'arrow-up';
  }
}

export function guideText(kind: TurnKind, side?: Side, ordinal?: number): string {
  const s = side ? SIDE[side] : '';
  const n = ordinal && ordinal > 1 ? `${ordinal}. Abzweigung ` : '';
  switch (kind) {
    case 'slight': return n ? `${n}leicht ${s}` : `Leicht ${s} halten`;
    case 'turn': return n ? `${n}${s}` : `${s[0].toUpperCase()}${s.slice(1)} abbiegen`;
    case 'sharp': return n ? `${n}scharf ${s}` : `Scharf ${s} abbiegen`;
    case 'uturn': return 'Wenden';
    case 'curve': return side === 'right' ? 'Scharfe Rechtskurve' : 'Scharfe Linkskurve';
    case 'finish': return 'Ziel';
    default: return 'Geradeaus';
  }
}

/** Symbol für einen Knick (AR: Pfeil an der nächsten Kurve) */
export function bendIcon(angle: number) {
  return icon(kindOf(angle), angle > 0 ? 'right' : 'left');
}

function kindOf(angle: number): TurnKind {
  const a = Math.abs(angle);
  return a > 160 ? 'uturn' : a >= 120 ? 'sharp' : a >= 55 ? 'turn' : 'slight';
}

/**
 * Wege einmal je Abfrage vorbereiten (useGuide): Abzweigungen im Abschnitt `from`…`to` und je Knick „Wege vorhanden?“ gemerkt –
 * vorher rechnete nextGuide beides alle 3 m für jeden Knick bis 5 km voraus neu.
 */
export type RoadIndex = {
  roads: LatLng[][];
  from: number;
  to: number;
  /** Berührpunkte im ganzen Abschnitt; je Abfrage nur noch „nächste Stichprobe im Fenster“ (wie findBranches, gleiche Ergebnisse) */
  touches: Touch[];
  grid: Map<number, number[]>;
  memo: Map<Touch, Map<number, Branch[]>>;
  cover: Map<number, boolean>;
};

export function indexRoads(s: Samples, roads: LatLng[][], from: number, to: number): RoadIndex {
  const [i0, i1] = windowOf(s, from, to);
  const grid = sampleGrid(s, i0, i1);
  return { roads, from, to, touches: roads.length ? touchesOf(s, roads, grid, i0, i1) : [], grid, memo: new Map(), cover: new Map() };
}

/** Ausschnitt [west, süd, ost, nord] um die Route zwischen `from` und `to` (m), `pad` m Rand – für die Wege-Abfrage. */
export function routeBox(s: Samples, from: number, to: number, pad = 300): [number, number, number, number] | null {
  const i0 = Math.max(0, Math.floor(from / STEP)), i1 = Math.min(s.pts.length - 1, Math.ceil(to / STEP));
  if (i1 < i0) return null;
  let w = Infinity, e = -Infinity, so = Infinity, n = -Infinity;
  for (let i = i0; i <= i1; i++) {
    const p = s.pts[i];
    if (p.lng < w) w = p.lng;
    if (p.lng > e) e = p.lng;
    if (p.lat < so) so = p.lat;
    if (p.lat > n) n = p.lat;
  }
  const dLat = pad / 110540, dLng = pad / (111320 * Math.cos((s.lat0 * Math.PI) / 180));
  return [w - dLng, so - dLat, e + dLng, n + dLat];
}

/** Knicke ab `along` als Hinweise (ohne Ziel/Geradeaus); Zählung „2. Abzweigung“ ab dem vorigen Hinweis. */
function* guidesFrom(s: Samples, bends: Bend[], roads: LatLng[][] | RoadIndex, along: number, range: number): Generator<Guide> {
  const idx = Array.isArray(roads) ? null : roads;
  const list = idx ? idx.roads : (roads as LatLng[][]);
  const covered = (b: Bend) => {
    if (!list.length) return false;
    if (!idx) return roadsCover(list, b.at);
    if (along < idx.from || b.along + 20 > idx.to) return false;
    let v = idx.cover.get(b.along);
    if (v === undefined) idx.cover.set(b.along, (v = roadsCover(list, b.at)));
    return v;
  };
  let from = along;
  for (const b of bends) {
    if (b.along <= along + 3) continue;
    if (b.along > along + range) break;
    const side: Side = b.angle > 0 ? 'right' : 'left';
    let kind: TurnKind | null = null;
    let ordinal: number | undefined;
    if (covered(b)) {
      const branches = idx ? once(collect(s, idx.touches, idx.grid, from, b.along + 20, idx.memo)) : findBranches(s, list, from, b.along + 20);
      const junction = branches.some((x) => Math.abs(x.along - b.along) <= 20);
      if (junction) {
        kind = kindOf(b.angle);
        ordinal = 1 + branches.filter((x) => x.side === side && x.along < b.along - 12).length;
      } else if (Math.abs(b.angle) >= 100) kind = 'curve';
    } else if (Math.abs(b.angle) >= 55) kind = kindOf(b.angle);
    if (!kind) continue;
    const ord = kind === 'curve' || kind === 'uturn' ? undefined : ordinal;
    yield { kind, side, ordinal: ord, dist: b.along - along, along: b.along, text: guideText(kind, side, ord), icon: icon(kind, side) };
    from = b.along + 12;
  }
}

const finish = (along: number, length: number): Guide => ({ kind: 'finish', dist: length - along, along: length, text: 'Ziel', icon: icon('finish') });

/**
 * Nächster Hinweis ab `along`. `roads` = Wege aus den Kacheln (leer = unbekannt) bzw. vorbereitet (indexRoads; Knicke außerhalb
 * seines Abschnitts gelten als „ohne Kacheln“).
 * Schaut höchstens `range` m voraus; sonst „Geradeaus“ bzw. „Ziel“.
 */
export function nextGuide(s: Samples, bends: Bend[], roads: LatLng[][] | RoadIndex, along: number, length: number, range = 5000): Guide {
  for (const g of guidesFrom(s, bends, roads, along, range)) return g;
  const toEnd = length - along;
  if (toEnd <= range) return finish(along, length);
  return { kind: 'straight', dist: Math.min(range, toEnd), along: along + range, text: 'Der Tour folgen', icon: icon('straight') };
}

/** Alle Hinweise bis zum Ziel (Liste beim Antippen des Abbiegehinweises, wie Google Maps), höchstens `max`, letzter = Ziel. */
export function upcomingGuides(s: Samples, bends: Bend[], roads: LatLng[][] | RoadIndex, along: number, length: number, max = 300): Guide[] {
  const out: Guide[] = [];
  for (const g of guidesFrom(s, bends, roads, along, Infinity)) {
    out.push(g);
    if (out.length >= max) return out;
  }
  out.push(finish(along, length));
  return out;
}

/** Für die Sprachansage: „350 m“ → „350 Metern“, „2,1 km“ → „2,1 Kilometern“ */
export function spokenDistance(m: number) {
  const r = m >= 1000 ? m : m >= 200 ? Math.round(m / 50) * 50 : Math.round(m / 10) * 10;
  return formatDistance(r).replace(/ km$/, ' Kilometern').replace(/ m$/, ' Metern');
}
