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
