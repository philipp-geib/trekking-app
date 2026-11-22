// iPhone: lokale Mitteilungen zu festen Zeiten (modules/local-notes/ios). Gleiches Präfix = alte werden ersetzt, [] = alle weg.
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type LocalNote = { id: string; title: string; body: string; at: number };
type LocalNotes = { schedule: (prefix: string, items: LocalNote[]) => Promise<boolean> };
const mod = Platform.OS === 'ios' ? requireOptionalNativeModule<LocalNotes>('LocalNotes') : null;

export function scheduleNotes(prefix: string, items: LocalNote[]): Promise<boolean> {
  return mod ? mod.schedule(prefix, items).catch(() => false) : Promise.resolve(false);
}
