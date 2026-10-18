importScripts("updater-core.js");
const say = (text, frac) => chrome.runtime.sendMessage({ type: "updprog", text, frac }).catch(() => {});
let updating = false;

// Check GitHub for a new version: badge on the icon + flag read by the popup and the in-page banner.
async function updCheck() {
  try {
    const u = await checkUpdate();
    await chrome.storage.local.set({ upd: u });
    await chrome.action.setBadgeText({ text: u.available ? "NEW" : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#6857e8" });
    return u;
  } catch (e) { return null; /* offline or rate-limited: try again later */ }
}
// One-click update: if the extension folder is already authorised, do it right here; otherwise open the one-time folder page.
async function startUpdate() {
  if (updating) return { busy: true };
  const h = await idbGet("dir");
  let ok = false;
  try { ok = !!h && (await h.queryPermission({ mode: "readwrite" })) === "granted"; } catch (e) {}
  if (!ok) { chrome.tabs.create({ url: chrome.runtime.getURL("update.html") }); return { tab: true }; }
  updating = true;
  try {
    const n = await applyUpdate(h, say);
    say(n ? "Updated. Reloading…" : "Already up to date.", 1);
    if (n) setTimeout(() => chrome.runtime.reload(), 700); else await updCheck();
    return { changed: n };
  } catch (e) { say("Update failed: " + e.message, 0); return { error: e.message }; }
  finally { updating = false; }
}
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create("upd", { periodInMinutes: 180 }); updCheck(); });
chrome.runtime.onStartup.addListener(updCheck);
chrome.alarms.onAlarm.addListener(a => { if (a.name === "upd") updCheck(); });
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg.type === "update") { startUpdate().then(send); return true; }
  if (msg.type === "updcheck") { updCheck().then(send); return true; }
});

// Downloads champion icons (cross-origin) and returns small JPEG data URIs.
chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg.type !== "icons") return;
  (async () => {
    const out = {};
    for (const [champ, url] of Object.entries(msg.urls)) {
      try {
        const bmp = await createImageBitmap(await (await fetch(url)).blob());
        const cv = new OffscreenCanvas(64, 64);
        cv.getContext("2d").drawImage(bmp, 0, 0, 64, 64);
        const bytes = new Uint8Array(await (await cv.convertToBlob({ type: "image/jpeg", quality: 0.85 })).arrayBuffer());
        let bin = "";
        for (const b of bytes) bin += String.fromCharCode(b);
        out[champ] = "data:image/jpeg;base64," + btoa(bin);
      } catch (e) { /* skip this icon */ }
    }
    send(out);
  })();
  return true;
});
