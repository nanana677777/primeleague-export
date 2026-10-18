const $ = s => document.querySelector(s);
const say = (t, c = "mut") => { $("#msg").className = c; $("#msg").textContent = t; };
const prog = f => { $("#fill").style.width = Math.round(f * 100) + "%"; };

async function pickFolder() {
  let h = await idbGet("dir");
  if (h) {
    try { if ((await h.requestPermission({ mode: "readwrite" })) === "granted") return h; } catch (e) { /* ask again below */ }
  }
  h = await showDirectoryPicker({ mode: "readwrite" });
  const mf = await localBuf(h, "manifest.json");
  let ok = false;
  try { const m = JSON.parse(new TextDecoder().decode(mf)); ok = m.name === chrome.runtime.getManifest().name; } catch (e) {}
  if (!ok) throw new Error("That folder doesn't contain this extension's manifest.json. Pick the folder you used in \"Load unpacked\".");
  await idbSet("dir", h);
  return h;
}

async function run() {
  $("#go").disabled = true; prog(0);
  try {
    say("Choose the extension folder…");
    const root = await pickFolder();
    const changed = await applyUpdate(root, (t, f) => { say(t); prog(f); });
    say(changed ? `Updated ${changed} file(s). Reloading the extension…` : "Already up to date.", "ok");
    if (changed) setTimeout(() => chrome.runtime.reload(), 900); else $("#go").disabled = false;
  } catch (e) {
    say(e.name === "AbortError" ? "Cancelled." : e.message, "err"); $("#go").disabled = false;
  }
}
$("#go").onclick = run;
(async () => {
  if (!(await idbGet("dir"))) $("#hint").hidden = false;
  try {
    const u = await checkUpdate();
    $("#ver").textContent = u.available ? `Installed v${u.local} → new version v${u.remote} available` : `Installed v${u.local} · latest on GitHub is v${u.remote}`;
    $("#go").textContent = u.available ? `Update to v${u.remote}` : "Re-sync files";
  } catch (e) { $("#ver").textContent = "Could not reach GitHub: " + e.message; }
  $("#go").disabled = false;
})();
