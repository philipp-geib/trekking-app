// Android: TREKKING über dem Sperrbildschirm zeigen (wie Google Maps beim Navigieren) – Handy bleibt gesperrt,
// nur diese App ist bedienbar. Zurück/Home oder eine andere App verlangt wieder die PIN.
package expo.modules.lockscreen

import android.os.Build
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LockScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LockScreen")

    Function("setShowWhenLocked") { on: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
          activity.setShowWhenLocked(on)
        } else {
          @Suppress("DEPRECATION")
          if (on) activity.window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
          else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
        }
      }
    }
  }
}
