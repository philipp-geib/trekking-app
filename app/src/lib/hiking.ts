// Höhenmeter und Gehzeit nach der Wanderzeit-Formel (DIN 33466).

/**
 * Auf- und Abstieg in Metern. Kleine Schwankungen (Messrauschen) unterhalb von `threshold`
 * zählen nicht – sonst summieren sich bei GPS-Höhen schnell Hunderte Phantom-Meter.
 */
export function climb(elevations: (number | undefined)[], threshold = 5): { up: number; down: number } {
  let up = 0, down = 0;
  let ref: number | undefined;
  for (const e of elevations) {
    if (e == null || !Number.isFinite(e)) continue;
    if (ref == null) { ref = e; continue; }
    const diff = e - ref;
    if (diff >= threshold) { up += diff; ref = e; }
    else if (diff <= -threshold) { down -= diff; ref = e; }
  }
  return { up, down };
}

export const HIKING = { kmPerHour: 4, upPerHour: 300, downPerHour: 500 };

/**
 * Gehzeit in Millisekunden: Zeit für die Strecke und Zeit für die Höhenmeter; die kleinere
 * der beiden zählt halb dazu.
 */
export function hikingTime(meters: number, up: number, down: number, pace = 1): number {
  const horizontal = meters / 1000 / HIKING.kmPerHour;
  const vertical = up / HIKING.upPerHour + down / HIKING.downPerHour;
  const hours = Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
  return (hours / pace) * 3600000;
}
