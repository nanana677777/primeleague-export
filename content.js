(() => {
  const links = [...document.querySelectorAll('.league-group-matches a[href*="/leagues/matches/"]')]
    .filter(a => /^\d+\s*:\s*\d+$/.test(a.textContent.trim()));
  if (!links.length) return; // not a group page with played matches
  const matches = new Map(links.map(a => [a.href, a.textContent.replace(/\s+/g, "")])); // url -> score
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const mid = u => (/\/matches\/(\d+)/.exec(u) || [])[1];
  const title = T(document.querySelector(".page-title h1")) || "Prime League group";
  const state = { running: false, done: 0, total: matches.size, text: "" };

  const btn = document.createElement("button");
  const label = `Export stats (.xlsx) · ${matches.size} matches`;
  btn.textContent = label;
  btn.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;padding:11px 16px;border:0;border-radius:10px;" +
    "background:#6857e8;color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35)";
  document.body.appendChild(btn);

  const emit = (text, done) => {
    state.text = text; if (done !== undefined) state.done = done;
    btn.textContent = text || label;
    try { chrome.runtime.sendMessage({ type: "progress", ...state }).catch(() => {}); } catch (e) {}
  };

  // The lineup (Prime League users of the match) is loaded by the site through this ajax call.
  async function fetchLineups(id) {
    const lang = (/^\/([a-z]{2})\//.exec(location.pathname) || [])[1] || "en";
    const body = new URLSearchParams({ id, action: "init", language: lang }), h = { "X-Requested-With": "XMLHttpRequest" };
    try {
      let t = await (await fetch("/ajax/leagues_match", { method: "POST", credentials: "include", headers: { ...h, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body })).text(), j;
      try { j = JSON.parse(t); } catch (e) { j = JSON.parse(await (await fetch("/ajax/leagues_match?" + body, { credentials: "include", headers: h })).text()); }
      return parseLineups(j);
    } catch (e) { console.warn("Prime League export: lineup", id, e); return null; }
  }

  async function runExport(opts) {
    if (state.running) return;
    state.running = true; btn.disabled = true;
    const entries = [...matches.entries()];
    const cache = opts.refresh ? {} : await chrome.storage.local.get(entries.map(([u]) => "m:" + mid(u)));
    const results = [], urlMap = {};
    let fresh = 0;
    for (let i = 0; i < entries.length; i++) {
      const [url, score] = entries[i], key = "m:" + mid(url), hit = cache[key];
      emit(`Reading match ${i + 1}/${entries.length}…`, i);
      let r = null;
      if (hit && hit.v === 4 && hit.games.length && hit.match.score.replace(/\s+/g, "") === score) r = hit; // cached, same score
      else {
        try {
          const res = await fetch(url, { credentials: "include" });
          r = parseMatch(new DOMParser().parseFromString(await res.text(), "text/html"), url);
          if (r.games.length) { r.lineups = await fetchLineups(mid(url)); await chrome.storage.local.set({ [key]: r }); fresh++; } else r = null;
        } catch (e) { console.warn("Prime League export:", url, e); }
        await sleep(400);
      }
      if (r) { results.push(r); Object.assign(urlMap, r.icons); }
    }
    if (!results.length) { state.running = false; btn.disabled = false; emit("No game data found. Are you logged out or blocked?", state.done); return; }

    // Map in-game names to Prime League accounts via the team rosters (remembered across exports, so renamed players stay linked).
    try {
      emit("Reading team rosters…");
      const acct = (await chrome.storage.local.get("acct")).acct || {};
      const turls = [...new Set(results.flatMap(r => [r.match.team1Url, r.match.team2Url]).filter(Boolean))];
      for (const u of turls) {
        try {
          const doc = new DOMParser().parseFromString(await (await fetch(u, { credentials: "include" })).text(), "text/html");
          for (const m of parseTeamPage(doc)) for (const nm of m.names) acct[nm.toLowerCase()] = { id: m.id, user: m.user };
        } catch (e) { console.warn("Prime League export: team page", u, e); }
        await sleep(300);
      }
      await chrome.storage.local.set({ acct });
      results.forEach(r => mapLineups(r, acct));
      await chrome.storage.local.set({ acct });
      results.forEach(r => r.players.forEach(p => { const a = acct[(p.player || "").toLowerCase()]; p.account = a ? a.id : ""; p.user = a ? a.user : ""; }));
    } catch (e) { console.warn(e); }

    let icons = {};
    if (opts.icons !== false) {
      const store = (await chrome.storage.local.get("icons")).icons || {};
      const need = Object.fromEntries(Object.entries(urlMap).filter(([c]) => !store[c]));
      if (Object.keys(need).length) {
        emit("Downloading champion icons…");
        try { Object.assign(store, (await chrome.runtime.sendMessage({ type: "icons", urls: need })) || {}); } catch (e) { console.warn(e); }
        await chrome.storage.local.set({ icons: store });
      }
      icons = Object.fromEntries(Object.entries(store).filter(([c]) => c in urlMap));
    }
    const group = (results[0].match.group || "group").replace(/[^\w.-]+/g, "_");
    const wb = buildWorkbook(results, icons), js = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "" });
    await chrome.storage.local.set({ dash: { draft: js("Draft"), players: js("Players"), tg: js("TeamGames"), games: js("Games"), icons, ts: Date.now() } });
    XLSX.writeFile(wb, `primeleague_${group}.xlsx`);
    await chrome.storage.local.set({ last: { t: Date.now(), group: results[0].match.group, matches: results.length } });
    state.running = false; btn.disabled = false;
    emit(`Done: ${results.length} matches (${fresh} new)`, entries.length);
    if (opts && opts.openDash) { try { chrome.runtime.sendMessage({ type: "opendash" }); } catch (e) {} }
    setTimeout(() => { if (!state.running) emit("", state.done); }, 4000);
  }

  // After an extension update/reload, this page keeps an orphaned script: chrome.* throws "Extension context invalidated".
  const alive = () => { try { return !!chrome.runtime.id; } catch (e) { return false; } };
  const stale = () => { btn.textContent = "Extension updated: reload this page (F5)"; btn.style.background = "#b45309"; };
  btn.onclick = async () => {
    if (!alive()) return stale();
    try { await runExport((await chrome.storage.local.get("opts")).opts || {}); } catch (e) { if (!alive()) stale(); else throw e; }
  };
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg.type === "status") send({ ok: true, title, ...state });
    else if (msg.type === "export") { runExport(msg.opts || {}); send({ started: true }); }
  });
})();
