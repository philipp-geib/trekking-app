// Fotos aus der Web-App in die Mediathek legen (Kamera-Fotos der WebView landen dort sonst nicht – Nutzer 22.11.:
// Fotos von unterwegs müssen auf jeden Fall auf dem Handy liegen). Seite → {type:'savePhoto', id, data: Daten-URL}.
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';

/** Daten-URL als Datei ablegen und in die Mediathek sichern; true = gesichert. */
export async function savePhoto(id: string, data: string): Promise<boolean> {
  const m = data.match(/^data:([^;,]*);base64,/);
  if (!m) return false;
  const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (!perm.granted) return false;
  const ext = /png/.test(m[1]) ? 'png' : /heic/.test(m[1]) ? 'heic' : 'jpg';
  const file = new File(Paths.cache, `trekking-${id.replace(/[^\w-]/g, '')}.${ext}`);
  try {
    await file.write(data.slice(m[0].length), { encoding: 'base64' });
    await MediaLibrary.saveToLibraryAsync(file.uri);
    return true;
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // egal
    }
  }
}
