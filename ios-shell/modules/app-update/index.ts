// Android: App aktualisiert sich selbst (modules/app-update). iPhone/alte Apps: nichts.
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type AppUpdate = { canInstall: () => boolean; openInstallSettings: () => void; install: (path: string) => Promise<string> };
export const appUpdate = Platform.OS === 'android' ? requireOptionalNativeModule<AppUpdate>('AppUpdate') : null;
