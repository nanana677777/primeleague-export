importScripts("updater-core.js");
// Check GitHub for a new version every 6 h and show a badge on the icon.
async function updCheck() {
  try {
    const u = await checkUpdate();
    await chrome.action.setBadgeText({ text: u.available ? "NEW" : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#6857e8" });
  } catch (e) { /* offline or rate-limited: try again later */ }
}
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create("upd", { periodInMinutes: 360 }); updCheck(); });
chrome.runtime.onStartup.addListener(updCheck);
chrome.alarms.onAlarm.addListener(a => { if (a.name === "upd") updCheck(); });

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
