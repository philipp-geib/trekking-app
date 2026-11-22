import ExpoModulesCore
import UIKit

// App-Symbol auf dem Home-Bildschirm wechseln (Wechsel-Symbole im Asset-Katalog, plugins/withAppIcons.js). nil = Haupt-Symbol.
public class AppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppIcon")

    AsyncFunction("setIcon") { (name: String?, promise: Promise) in
      let app = UIApplication.shared
      guard app.supportsAlternateIcons else { return promise.resolve(false) }
      if app.alternateIconName == name { return promise.resolve(true) }
      app.setAlternateIconName(name) { error in
        promise.resolve(error == nil)
      }
    }.runOnQueue(.main)
  }
}
