// Shows a bar at the top of Prime League pages when a new extension version is on GitHub.
(async () => {
  const { upd, bannerHide } = await chrome.storage.local.get(["upd", "bannerHide"]);
  if (!upd || !upd.available || bannerHide === upd.remote) return;
  const bar = document.createElement("div");
  bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;display:flex;gap:12px;align-items:center;justify-content:center;" +
    "padding:8px 12px;background:#6857e8;color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3)";
  const t = document.createElement("span"); t.textContent = `Prime League Export v${upd.remote} is available (you have v${upd.local}).`;
  const go = document.createElement("button"), x = document.createElement("button");
  go.textContent = "Update now"; x.textContent = "Later";
  for (const b of [go, x]) b.style.cssText = "border:0;border-radius:6px;padding:5px 10px;cursor:pointer;font:600 12px system-ui,sans-serif;background:#fff;color:#4a3bc4";
  go.onclick = async () => {
    go.disabled = true; t.textContent = "Updating…";
    const r = await chrome.runtime.sendMessage({ type: "update" }).catch(() => null);
    t.textContent = r && r.tab ? "First time: choose the extension folder in the new tab." : r && r.error ? "Update failed: " + r.error : "Updated. The extension is reloading; refresh this page.";
    if (r && r.error) go.disabled = false;
  };
  x.onclick = () => { chrome.storage.local.set({ bannerHide: upd.remote }); bar.remove(); };
  bar.append(t, go, x); document.documentElement.appendChild(bar);
})();
