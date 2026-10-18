const $ = s => document.querySelector(s);
let tab;
const ask = async msg => { try { return await chrome.tabs.sendMessage(tab.id, msg); } catch (e) { return null; } };
const opts = () => ({ icons: $("#icons").checked, refresh: $("#refresh").checked });

function render(s) {
  $("#fill").style.width = s.total ? Math.round((s.done / s.total) * 100) + "%" : "0%";
  $("#msg").textContent = s.text || "\u00a0";
  $("#go").disabled = !!s.running;
}
async function cacheInfo() {
  const all = await chrome.storage.local.get(null);
  const n = Object.keys(all).filter(k => k.startsWith("m:")).length;
  $("#clr").textContent = `Clear saved data (${n})`;
  return all.last;
}
(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const saved = (await chrome.storage.local.get("opts")).opts || {};
  $("#icons").checked = saved.icons !== false;
  $("#refresh").checked = !!saved.refresh;
  const last = await cacheInfo();
  const s = await ask({ type: "status" });
  if (s && s.ok) {
    $("#st").textContent = `${s.title} · ${s.total} played matches`;
    $("#go").disabled = !!s.running;
    render(s);
  } else {
    $("#st").textContent = "Open a Prime League group page (Gruppenspiele) with played matches, then reopen this popup.";
    if (last) $("#msg").textContent = `Last export: ${last.group}, ${last.matches} matches, ${new Date(last.t).toLocaleString()}`;
  }
})();
document.addEventListener("change", () => chrome.storage.local.set({ opts: opts() }));
$("#go").onclick = async () => {
  await chrome.storage.local.set({ opts: opts() });
  $("#go").disabled = true;
  $("#msg").textContent = "Starting…";
  if (!(await ask({ type: "export", opts: opts() }))) $("#msg").textContent = "Could not reach the page. Reload it and try again.";
};
chrome.runtime.onMessage.addListener(m => { if (m.type === "progress") { render(m); if (!m.running) cacheInfo(); } });
$("#dash").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
$("#clr").onclick = async () => {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter(k => k.startsWith("m:") || k === "icons"));
  cacheInfo();
};

const ver = chrome.runtime.getManifest().version;
$("#updtxt").textContent = "v" + ver;
const showUpd = u => {
  if (!u) return;
  if (u.available) { $("#updgo").textContent = "Update to v" + u.remote; $("#updgo").classList.remove("hide"); $("#updtxt").textContent = "v" + u.local + " installed · new version available"; }
  else $("#updtxt").textContent = "v" + u.local + " · up to date";
};
chrome.storage.local.get("upd").then(({ upd }) => showUpd(upd)); // instant, from the background check
chrome.runtime.sendMessage({ type: "updcheck" }).then(showUpd).catch(() => {}); // then refresh
$("#updgo").onclick = async () => {
  $("#updgo").disabled = true; $("#ubar").classList.remove("hide");
  const r = await chrome.runtime.sendMessage({ type: "update" }).catch(() => null);
  if (r && r.tab) { $("#updtxt").textContent = "First time: choose the extension folder in the new tab."; $("#ubar").classList.add("hide"); }
  if (r && r.error) $("#updgo").disabled = false;
};
chrome.runtime.onMessage.addListener(m => {
  if (m.type !== "updprog") return;
  $("#ufill").style.width = Math.round((m.frac || 0) * 100) + "%"; $("#updtxt").textContent = m.text;
});
