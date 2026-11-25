// Dateien und Links aus der Web-App teilen. Die Android-WebView kann weder Blob-Downloads (GPX, FIT, Excel – DownloadManager
// nimmt nur http/https) noch navigator.share → die Seite schickt {type:'file', name, data: Daten-URL} bzw. {type:'share', …}.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

/** Daten-URL als Datei ablegen und das Teilen-Menü öffnen (Drive, Mail, Garmin Connect, „In Dateien sichern“ …). */
export async function shareFile(name: string, data: string): Promise<boolean> {
  const m = data.match(/^data:([^;,]*);base64,/);
  if (!m) return false;
  const safe = name.replace(/[/\\:*?"<>|]/g, '').trim() || 'TREKKING';
  const file = new File(Paths.cache, safe);
  if (file.exists) file.delete();
  await file.write(data.slice(m[0].length), { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, { mimeType: m[1] || 'application/octet-stream', dialogTitle: safe });
  return true;
}

/** Link/Text über das Teilen-Menü des Systems */
export async function shareText(title: string, text: string, url: string) {
  // Android kennt nur message, iPhone hängt url selbst an
  if (Platform.OS === 'ios') await Share.share({ title, message: text, url: url || undefined });
  else await Share.share({ title, message: [text, url].filter(Boolean).join('\n') });
}
