import ExpoModulesCore
import UserNotifications

// Lokale Mitteilungen zu festen Zeiten (Ablauf-Erinnerung, src/expiry.ts). Nur UNUserNotificationCenter – braucht keine
// Push-Berechtigung (aps-environment), geht also mit kostenloser Apple-ID. Alle Mitteilungen eines Präfixes werden ersetzt.
public class LocalNotesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LocalNotes")

    // items: [{ id, title, body, at (ms seit 1970) }]
    AsyncFunction("schedule") { (prefix: String, items: [[String: Any]], promise: Promise) in
      let center = UNUserNotificationCenter.current()
      center.getPendingNotificationRequests { pending in
        center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) })
        if items.isEmpty { return promise.resolve(true) }
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
          guard granted else { return promise.resolve(false) }
          for item in items {
            guard let id = item["id"] as? String, let at = item["at"] as? Double else { continue }
            let secs = at / 1000 - Date().timeIntervalSince1970
            if secs < 30 { continue }
            let content = UNMutableNotificationContent()
            content.title = item["title"] as? String ?? ""
            content.body = item["body"] as? String ?? ""
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: secs, repeats: false)
            center.add(UNNotificationRequest(identifier: prefix + id, content: content, trigger: trigger))
          }
          promise.resolve(true)
        }
      }
    }
  }
}
