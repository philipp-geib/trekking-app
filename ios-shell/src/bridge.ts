// Wird vor dem Laden jeder Seite in die WebView gespritzt: kennzeichnet die App (window.TREKKING_SHELL) und ersetzt
// navigator.geolocation durch den Standort der App (kein Website-Standort-Dialog, Aufzeichnung bei gesperrtem Bildschirm).
// App → Seite: window.__trekkingGeo(pos), window.__trekkingGeoError(code, text). Seite → App: postMessage {type:'geo', …}.
// speech: Seite spricht über die App ({type:'say'|'hush'|'voices'}, Antwort window.__trekkingVoices(list)).
// insets: Ränder in CSS-Pixeln (Android zeichnet randlos, die WebView meldet sie aber nicht über env(safe-area-inset-*)).
export const bridge = (platform: string, insets: { top: number; bottom: number }) => `(function () {
  if (window.TREKKING_SHELL) return;
  window.TREKKING_SHELL = { version: 3, speech: true, photos: true, icons: ${platform === 'ios'}, platform: ${JSON.stringify(platform)}, insets: ${JSON.stringify(insets)} };
  var send = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var watchers = {}, next = 1, pending = [], last = null;
  var count = function () { return Object.keys(watchers).length; };
  var geo = {
    getCurrentPosition: function (ok, fail, opt) {
      var age = (opt && opt.maximumAge) || 0;
      if (last && Date.now() - last.timestamp <= Math.max(age, 5000)) { setTimeout(function () { ok(last); }, 0); return; }
      pending.push({ ok: ok, fail: fail });
      send({ type: 'geo', op: 'once' });
    },
    watchPosition: function (ok, fail) {
      var id = next++;
      watchers[id] = { ok: ok, fail: fail };
      send({ type: 'geo', op: 'watch', n: count() });
      if (last) setTimeout(function () { if (watchers[id]) ok(last); }, 0);
      return id;
    },
    clearWatch: function (id) {
      if (!watchers[id]) return;
      delete watchers[id];
      send({ type: 'geo', op: 'watch', n: count() });
    }
  };
  try { Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true }); } catch (e) {}
  window.__trekkingGeo = function (p) {
    last = p;
    pending.splice(0).forEach(function (x) { try { x.ok(p); } catch (e) {} });
    Object.keys(watchers).forEach(function (k) { try { watchers[k].ok(p); } catch (e) {} });
  };
  window.__trekkingGeoError = function (code, text) {
    var e = { code: code, message: text, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
    pending.splice(0).forEach(function (x) { if (x.fail) x.fail(e); });
    Object.keys(watchers).forEach(function (k) { if (watchers[k].fail) watchers[k].fail(e); });
  };
})();
true;`;
