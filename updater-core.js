/* Shared update logic (popup, background, update page). Source of truth = the GitHub repo below. */
const UPD = { repo: "nanana677777/primeleague-export", branch: "main" };
UPD.raw = `https://raw.githubusercontent.com/${UPD.repo}/${UPD.branch}/`;
UPD.tree = `https://api.github.com/repos/${UPD.repo}/git/trees/${UPD.branch}?recursive=1`;
UPD.skip = p => p.startsWith(".") || p.includes("/.") || /^(README|LICENSE)/i.test(p);

function cmpVer(a, b) {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
async function checkUpdate() {
  const r = await fetch(UPD.raw + "manifest.json?t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error("GitHub answered " + r.status);
  const remote = (await r.json()).version, local = chrome.runtime.getManifest().version;
  return { local, remote, available: cmpVer(remote, local) > 0 };
}

// ---- update engine (runs in the service worker or the update page) ----
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("upd", 1); r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async k => { const d = await idb(); return new Promise(res => { const q = d.transaction("k").objectStore("k").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); };
const idbSet = async (k, v) => { const d = await idb(); return new Promise(res => { const t = d.transaction("k", "readwrite"); t.objectStore("k").put(v, k); t.oncomplete = res; }); };
async function gitSha(buf) {
  const h = new TextEncoder().encode("blob " + buf.byteLength + "\0"), all = new Uint8Array(h.length + buf.byteLength);
  all.set(h); all.set(new Uint8Array(buf), h.length);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-1", all))].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function getDir(root, path, create) {
  let d = root;
  for (const p of path.split("/").slice(0, -1)) d = await d.getDirectoryHandle(p, { create });
  return d;
}
async function localBuf(root, path) {
  try { const d = await getDir(root, path, false), f = await d.getFileHandle(path.split("/").pop()); return await (await f.getFile()).arrayBuffer(); }
  catch (e) { return null; }
}
// Downloads every changed file from GitHub into the extension folder. onProg(text, fraction). Returns number of files written.
async function applyUpdate(root, onProg = () => {}) {
  onProg("Reading file list from GitHub…", 0);
  const tr = await fetch(UPD.tree, { cache: "no-store" });
  if (!tr.ok) throw new Error("GitHub answered " + tr.status + (tr.status === 403 ? " (rate limit, try again in a few minutes)" : ""));
  const files = (await tr.json()).tree.filter(f => f.type === "blob" && !UPD.skip(f.path));
  files.sort((a, b) => (a.path === "manifest.json") - (b.path === "manifest.json")); // manifest last
  let changed = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i]; onProg(`Checking ${f.path}…`, i / files.length);
    const cur = await localBuf(root, f.path);
    if (cur && (await gitSha(cur)) === f.sha) continue;
    const r = await fetch(UPD.raw + f.path + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(`Could not download ${f.path} (${r.status})`);
    const data = await r.arrayBuffer();
    const dir = await getDir(root, f.path, true), fh = await dir.getFileHandle(f.path.split("/").pop(), { create: true });
    const w = await fh.createWritable(); await w.write(data); await w.close();
    changed++;
  }
  onProg("Done", 1);
  return changed;
}
