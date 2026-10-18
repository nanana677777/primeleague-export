const $ = s => document.querySelector(s);
const say = (t, c = "mut") => { $("#msg").className = c; $("#msg").textContent = t; };
const prog = f => { $("#fill").style.width = Math.round(f * 100) + "%"; };

// --- remember the extension folder handle across visits ---
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("upd", 1); r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async k => { const d = await idb(); return new Promise(res => { const q = d.transaction("k").objectStore("k").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); };
const idbSet = async (k, v) => { const d = await idb(); return new Promise(res => { const t = d.transaction("k", "readwrite"); t.objectStore("k").put(v, k); t.oncomplete = res; }); };

async function gitSha(buf) {
  const h = new TextEncoder().encode("blob " + buf.byteLength + "\0"), all = new Uint8Array(h.length + buf.byteLength);
  all.set(h); all.set(new Uint8Array(buf), h.length);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-1", all))].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function getDir(root, path, create) {
  let d = root; const parts = path.split("/").slice(0, -1);
  for (const p of parts) d = await d.getDirectoryHandle(p, { create });
  return d;
}
async function localBuf(root, path) {
  try { const d = await getDir(root, path, false), f = await d.getFileHandle(path.split("/").pop()); return await (await f.getFile()).arrayBuffer(); }
  catch (e) { return null; }
}
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
    say("Reading file list from GitHub…");
    const tr = await fetch(UPD.tree, { cache: "no-store" });
    if (!tr.ok) throw new Error("GitHub answered " + tr.status + (tr.status === 403 ? " (rate limit, try again in a few minutes)" : ""));
    const files = (await tr.json()).tree.filter(f => f.type === "blob" && !UPD.skip(f.path));
    files.sort((a, b) => (a.path === "manifest.json") - (b.path === "manifest.json")); // manifest last
    let changed = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i]; prog(i / files.length); say(`Checking ${f.path}…`);
      const cur = await localBuf(root, f.path);
      if (cur && (await gitSha(cur)) === f.sha) continue;
      const r = await fetch(UPD.raw + f.path + "?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error(`Could not download ${f.path} (${r.status})`);
      const data = await r.arrayBuffer();
      const dir = await getDir(root, f.path, true), fh = await dir.getFileHandle(f.path.split("/").pop(), { create: true });
      const w = await fh.createWritable(); await w.write(data); await w.close();
      changed++;
    }
    prog(1);
    say(changed ? `Updated ${changed} file(s). Reloading the extension…` : "Already up to date.", "ok");
    if (changed) setTimeout(() => chrome.runtime.reload(), 900);
    else $("#go").disabled = false;
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
