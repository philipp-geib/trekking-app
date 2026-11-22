// iPhone: App-Symbol nach Farbe + Darstellung der Seite ({type:'icon', name}); Namen = plugins/withAppIcons.js, null = Haupt-Symbol.
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type AppIcon = { setIcon: (name: string | null) => Promise<boolean> };
const mod = Platform.OS === 'ios' ? requireOptionalNativeModule<AppIcon>('AppIcon') : null;

const NAME = /^[a-z]+-(hell|dunkel|auto)$/;
let last: string | null | undefined;

export function setAppIcon(name: string | null) {
  if (name !== null && !NAME.test(name)) return;
  if (!mod || name === last) return;
  last = name;
  mod.setIcon(name).catch(() => {
    last = undefined;
  });
}
