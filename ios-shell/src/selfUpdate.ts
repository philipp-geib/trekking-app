// Android: neue App-Version selbst holen und einspielen (modules/app-update). Beim Start / Zurückkommen still prüfen und die APK laden,
// eingespielt wird, sobald TREKKING im Hintergrund ist (keine Tour) – App endet dabei, beim nächsten Öffnen läuft die neue Version.
// „Aktualisieren“ auf der Home-Karte (Seite → {type:'selfUpdate'}) spielt sofort ein, fragt vorher einmal nach dem Installieren-Recht.
import { Directory, File, Paths } from 'expo-file-system';
import { appUpdate } from '../modules/app-update';

const HOME = 'https://trek-king.pages.dev';
let ready: { v: number; file: File } | null = null;
let loading: Promise<void> | null = null;
let lastCheck = 0;

export const selfUpdateOk = () => !!appUpdate;

async function latest(): Promise<number> {
  const r = await fetch(`${HOME}/app/version.json?t=${Date.now()}`, { cache: 'no-store' });
  return Number(((await r.json()) as { android?: number }).android) || 0;
}

/** Neuere APK im Cache bereitlegen (höchstens alle 30 min geprüft, außer force). */
export function prepare(build: number, force = false): Promise<void> {
  if (!appUpdate || loading) return loading ?? Promise.resolve();
  if (!force && Date.now() - lastCheck < 30 * 60 * 1000) return Promise.resolve();
  lastCheck = Date.now();
  loading = (async () => {
    const v = await latest();
    if (v <= build || ready?.v === v) return;
    const dir = new Directory(Paths.cache, 'update');
    if (dir.exists) dir.delete();
    dir.create();
    const file = await File.downloadFileAsync(`${HOME}/app/TREKKING.apk?v=${v}`, new File(dir, `TREKKING-${v}.apk`), { idempotent: true });
    if ((file.size ?? 0) > 5_000_000) ready = { v, file };
  })()
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Bereitgelegte APK einspielen (im Hintergrund still; Rückfrage nur, wenn das System sie verlangt). */
export async function installReady(): Promise<string> {
  if (!appUpdate || !ready || !appUpdate.canInstall()) return 'none';
  return appUpdate.install(ready.file.uri.replace(/^file:\/\//, ''));
}

/** Fingertipp „Aktualisieren“: Recht prüfen, laden, einspielen. false = Recht fehlt (Einstellungen geöffnet). */
export async function updateNow(build: number): Promise<boolean> {
  if (!appUpdate) return false;
  if (!appUpdate.canInstall()) {
    appUpdate.openInstallSettings();
    return false;
  }
  await prepare(build, true);
  await installReady();
  return true;
}

export const canInstall = () => !!appUpdate?.canInstall();
