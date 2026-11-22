// Rechnen auf der Erdkugel: Abstände, Richtungen und der nächste Punkt auf einer Route.

export type LatLng = { lat: number; lng: number };

const R = 6371008.8; // mittlerer Erdradius in Metern
const RAD = Math.PI / 180;

export const norm360 = (deg: number) => ((deg % 360) + 360) % 360;
/** Kürzester Drehwinkel −180…180 – auch für aufgerollte Winkel (> 360 oder < −360; `(d + 540) % 360` versagt dort). */
export const wrap180 = (deg: number) => norm360(deg + 180) - 180;

/** Abstand zweier Punkte in Metern (Haversine). */
export function distance(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Richtung von a nach b in Grad ab Nord im Uhrzeigersinn. */
export function bearing(a: LatLng, b: LatLng): number {
  const phi1 = a.lat * RAD;
  const phi2 = b.lat * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return norm360(Math.atan2(y, x) / RAD);
}

/** Punkt, der `meters` Meter in Richtung `deg` von `from` entfernt liegt. */
export function destination(from: LatLng, deg: number, meters: number): LatLng {
  const d = meters / R;
  const th = deg * RAD;
  const phi1 = from.lat * RAD;
  const lam1 = from.lng * RAD;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(th));
  const lam2 = lam1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(phi1), Math.cos(d) - Math.sin(phi1) * Math.sin(phi2));
  return { lat: phi2 / RAD, lng: ((lam2 / RAD + 540) % 360) - 180 };
}

/** Kumulierte Strecke entlang einer Linie in Metern, ein Wert pro Punkt. */
export function cumulativeDistances(points: LatLng[]): number[] {
  const out = new Array<number>(points.length);
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) sum += distance(points[i - 1], points[i]);
    out[i] = sum;
  }
  return out;
}

export type Bounds = { west: number; south: number; east: number; north: number };

export function boundsOf(points: LatLng[]): Bounds | null {
  if (!points.length) return null;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const p of points) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }
  return { west, south, east, north };
}

/** Vergrößert ein Rechteck auf allen Seiten um `meters`. */
export function padBounds(b: Bounds, meters: number): Bounds {
  const dLat = meters / 111320;
  const mid = ((b.north + b.south) / 2) * RAD;
  const dLng = dLat / Math.max(0.01, Math.cos(mid));
  return {
    west: Math.max(-180, b.west - dLng),
    south: Math.max(-85, b.south - dLat),
    east: Math.min(180, b.east + dLng),
    north: Math.min(85, b.north + dLat),
  };
}

export type RouteMatch = {
  /** Abstand zur Route in Metern */
  distance: number;
  /** nächster Punkt auf der Route */
  point: LatLng;
  /** Strecke vom Start bis zum nächsten Punkt in Metern */
  along: number;
  /** Index des Abschnitts (zwischen Punkt i und i+1) */
  segment: number;
};

/**
 * Nächster Punkt auf einer Route. Liegen mehrere Abschnitte fast gleich nah (Hin- und
 * Rückweg auf demselben Pfad, Schleifen), gewinnt der, der am besten zum bisherigen
 * Fortschritt `previousAlong` passt.
 */
export function matchRoute(pos: LatLng, points: LatLng[], cumulative: number[], previousAlong?: number): RouteMatch | null {
  if (points.length === 0) return null;
  if (points.length === 1) {
    return { distance: distance(pos, points[0]), point: points[0], along: 0, segment: 0 };
  }
  // Lokale ebene Projektion um die Position – auf Wanderdistanzen genau genug.
  const kx = Math.cos(pos.lat * RAD) * R * RAD;
  const ky = R * RAD;
  const candidates: RouteMatch[] = [];
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const ax = (a.lng - pos.lng) * kx, ay = (a.lat - pos.lat) * ky;
    const bx = (b.lng - pos.lng) * kx, by = (b.lat - pos.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy;
    const d = Math.hypot(px, py);
    if (d > best + 25) continue;
    const point = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
    const along = cumulative[i] + t * (cumulative[i + 1] - cumulative[i]);
    candidates.push({ distance: d, point, along, segment: i });
    if (d < best) best = d;
  }
  const close = candidates.filter((c) => c.distance <= best + 20);
  if (previousAlong == null || close.length === 1) {
    return close.reduce((x, y) => (y.distance < x.distance ? y : x));
  }
  // Leicht bevorzugt: ein Stück voraus statt zurück.
  const score = (c: RouteMatch) => Math.abs(c.along - previousAlong) + (c.along < previousAlong ? 50 : 0);
  return close.reduce((x, y) => (score(y) < score(x) ? y : x));
}

/** Punkt bei Strecke `along` entlang der Route. */
export function pointAlong(points: LatLng[], cumulative: number[], along: number): LatLng {
  if (points.length === 0) throw new Error('leere Tour');
  if (along <= 0) return points[0];
  const total = cumulative[cumulative.length - 1];
  if (along >= total) return points[points.length - 1];
  let lo = 0, hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= along) lo = mid;
    else hi = mid;
  }
  const span = cumulative[hi] - cumulative[lo];
  const t = span > 0 ? (along - cumulative[lo]) / span : 0;
  return { lat: points[lo].lat + t * (points[hi].lat - points[lo].lat), lng: points[lo].lng + t * (points[hi].lng - points[lo].lng) };
}

/** Kreis als Polygon-Ring (für GeoJSON), Radius in Metern. */
export function circleRing(center: LatLng, meters: number, steps = 48): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const p = destination(center, (i / steps) * 360, meters);
    ring.push([p.lng, p.lat]);
  }
  return ring;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '–';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0).replace('.', ',')} km`;
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  return h ? `${h} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`;
}

const DIRECTIONS = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compassDirection = (deg: number) => DIRECTIONS[Math.round(norm360(deg) / 22.5) % 16];
