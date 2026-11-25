// Android: TREKKING aktualisiert sich selbst (Nutzer 25.11.: ohne Neuinstallieren). Ab Android 12 ohne Rückfrage, wenn eine App
// sich selbst aktualisiert (PackageInstaller + USER_ACTION_NOT_REQUIRED, Rechte REQUEST_INSTALL_PACKAGES + UPDATE_PACKAGES_WITHOUT_USER_ACTION).
// Einmalig nötig: „Apps aus dieser Quelle installieren“ für TREKKING erlauben (openInstallSettings). Verlangt das System doch eine Bestätigung,
// zeigt es seinen Dialog (nur im Vordergrund möglich).
package expo.modules.appupdate

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class AppUpdateModule : Module() {
  private val ctx: Context get() = appContext.reactContext ?: throw IllegalStateException("kein Kontext")
  private val action get() = "${ctx.packageName}.APP_UPDATE"

  override fun definition() = ModuleDefinition {
    Name("AppUpdate")

    Function("canInstall") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ctx.packageManager.canRequestPackageInstalls()
    }

    Function("openInstallSettings") {
      val i = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}"))
      else Intent(Settings.ACTION_SECURITY_SETTINGS)
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(i)
    }

    /** APK unter path installieren → "ok" | "pending" (System fragt) | "failed: …" (bei Erfolg endet die App meist vorher) */
    AsyncFunction("install") { path: String, promise: Promise ->
      try {
        install(File(path), promise)
      } catch (e: Exception) {
        promise.resolve("failed: ${e.message}")
      }
    }
  }

  @SuppressLint("UnspecifiedRegisterReceiverFlag")
  private fun install(apk: File, promise: Promise) {
    val c = ctx
    val pi = c.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    params.setAppPackageName(c.packageName)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
      params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
    val id = pi.createSession(params)

    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1) != id) return
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
          @Suppress("DEPRECATION")
          val confirm: Intent? = if (Build.VERSION.SDK_INT >= 33)
            intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
          else intent.getParcelableExtra(Intent.EXTRA_INTENT)
          confirm?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          try {
            if (confirm != null) context.startActivity(confirm)
          } catch (_: Exception) {
          }
          return // Ergebnis kommt danach noch einmal
        }
        try {
          context.unregisterReceiver(this)
        } catch (_: Exception) {
        }
        promise.resolve(
          if (status == PackageInstaller.STATUS_SUCCESS) "ok"
          else "failed: ${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: status}"
        )
      }
    }
    val filter = IntentFilter(action)
    if (Build.VERSION.SDK_INT >= 33) c.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    else c.registerReceiver(receiver, filter)

    pi.openSession(id).use { s ->
      apk.inputStream().use { input ->
        s.openWrite("base.apk", 0, apk.length()).use { out ->
          input.copyTo(out)
          s.fsync(out)
        }
      }
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
      val pending = PendingIntent.getBroadcast(c, id, Intent(action).setPackage(c.packageName), flags)
      s.commit(pending.intentSender)
    }
  }
}
