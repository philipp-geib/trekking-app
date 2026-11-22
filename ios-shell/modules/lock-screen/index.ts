// Android: App über dem Sperrbildschirm zeigen, solange eine Tour läuft (iPhone erlaubt das Apps nicht).
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type LockScreen = { setShowWhenLocked: (on: boolean) => void };
const mod = Platform.OS === 'android' ? requireOptionalNativeModule<LockScreen>('LockScreen') : null;

export function showWhenLocked(on: boolean) {
  try {
    mod?.setShowWhenLocked(on);
  } catch {
    // ältere App ohne Modul
  }
}
