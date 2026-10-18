/* Parsing of a Prime League match page + Excel workbook building (content-script world). */
const ROLES = ["Top", "Jungle", "Mid", "Bot", "Support"];
const _ta = document.createElement("textarea");
const clean = s => { _ta.innerHTML = String(s || "").replace(/</g, "&lt;"); return _ta.value.replace(/\s+/g, " ").trim(); };
const T = el => (el ? clean(el.textContent) : "");
const num = s => { const d = String(s == null ? "" : s).replace(/\D/g, ""); return d ? +d : null; };
const idx = (el, p) => { for (const c of el.classList) { const m = new RegExp("^" + p + "-(\\d)$").exec(c); if (m) return +m[1]; } return 0; };
const colorOf = el => el.classList.contains("color-b") ? "Blue" : el.classList.contains("color-r") ? "Red" : "";
const resOf = s => /^(sieg|victory|win)$/i.test(s) ? "Win" : "Loss";
const kda = s => { const p = (s || "").split("/"); return [0, 1, 2].map(i => /^\d+$/.test((p[i] || "").trim()) ? +p[i] : null); };
const secs = s => { const m = /^(\d+):(\d+)$/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : null; };

// Stable account id of a player row (profile link or data attribute); "" when the page has none.
const acctId = p => {
  const link = p.querySelector(".submatch-lol-player-name a[href]") || p.querySelector("a[href]");
  if (link) { const h = link.getAttribute("href") || "", m = /(?:users?|players?|profiles?|summoners?|accounts?|members?)\/(\d+)/i.exec(h) || /(\d{3,})/.exec(h); if (m) return m[1]; }
  for (const el of [p, ...p.querySelectorAll("*")]) for (const a of el.attributes) if (/^data-(user|player|account|summoner|member|id|puuid)/i.test(a.name) && a.value) return a.value;
  return "";
};

function parseMatch(doc, url) {
  const q = (r, s) => r.querySelector(s), qa = (r, s) => [...r.querySelectorAll(s)];
  const holder = q(doc, "#league-match-content");
  const mid = (holder && holder.dataset.matchId) || ((/\/matches\/(\d+)/.exec(url) || [])[1]) || "";
  const crumbs = qa(doc, "ul.breadcrumbs li").map(T);
  const group = crumbs.length >= 3 ? crumbs[crumbs.length - 2] : "";
  const subs = qa(doc, ".content-match-subtitles .txt-subtitle").map(T);
  const when = T(q(doc, "#league-match-time")), matchday = subs[1] || "";
  const [t1 = "", t2 = ""] = qa(doc, ".content-match-head-team h2").map(T);
  const name = `${t1} vs ${t2}`;
  const out = { match: { id: mid, group, matchday, date: when, team1: t1, team2: t2, score: T(q(doc, ".txt-score")),
    format: T(q(doc, ".content-match-head-score .txt-info")), games: 0, url }, games: [], drafts: [], tgs: [], players: [], icons: {} };
  const icon = (champ, img) => { const s = img && (img.getAttribute("src") || img.getAttribute("data-src") || ""); if (champ && s && s.startsWith("http")) out.icons[champ] = s; };

  for (const sec of qa(doc, "section.league-match-sub-lol")) {
    const gm = /\d+/.exec(T(q(sec, "h2"))), gno = gm ? +gm[0] : out.games.length + 1;
    const info = {};
    qa(sec, "ul.quick-info li").forEach(li => { info[T(q(li, ".qi-label")).replace(/:$/, "")] = T(q(li, ".qi-value")); });
    const heads = {}, objs = {};
    qa(sec, ".submatch-lol-head .submatch-lol-head-side").forEach(h => {
      const [k, d, a] = kda(T(q(h, ".submatch-lol-team-kda span"))), g = q(h, ".submatch-lol-team-networth span");
      heads[idx(h, "side")] = { team: T(q(h, ".submatch-lol-team-name")), color: colorOf(h), result: resOf(T(q(h, ".submatch-lol-team-result"))),
        kills: k, deaths: d, assists: a, gold: g ? num(g.getAttribute("title") || T(g)) : null };
    });
    qa(sec, ".submatch-lol-base .submatch-lol-base-side").forEach(b => {
      const v = qa(b, ".submatch-lol-objectives span").map(x => num(x.textContent));
      objs[idx(b, "side")] = [0, 1, 2, 3, 4].map(i => (v[i] === undefined ? null : v[i]));
    });
    if (!Object.keys(heads).length) continue;
    const blue = (Object.values(heads).find(h => h.color === "Blue") || {}).team || "";
    const red = (Object.values(heads).find(h => h.color === "Red") || {}).team || "";
    const winner = (Object.values(heads).find(h => h.result === "Win") || {}).team || "";
    const dur = secs(info["Dauer"]), min = dur ? Math.round(dur / 60 * 100) / 100 : null;
    out.games.push({ match: name, group, matchday, date: when, game: gno, gameId: info["Ingame ID"] || "", blue, red, winner, min,
      created: info["Erstellt am"] || "", start: info["Start"] || "", end: info["Ende"] || "" });

    qa(sec, "ul.submatch-lol-draft li.draft-item").forEach((li, i) => {
      const img = q(li, "img"), champ = clean(li.getAttribute("title") || (img && img.getAttribute("alt")) || "");
      const color = li.classList.contains("blue") ? "Blue" : "Red";
      icon(champ, img);
      out.drafts.push({ match: name, group, matchday, game: gno, order: i + 1, type: li.classList.contains("ban") ? "Ban" : "Pick",
        champion: champ, side: color, team: color === "Blue" ? blue : red });
    });
    for (const [s, h] of Object.entries(heads)) {
      const opp = (Object.entries(heads).find(([k]) => k !== s) || [0, {}])[1].team || "", o = objs[s] || [null, null, null, null, null];
      out.tgs.push({ match: name, group, matchday, game: gno, team: h.team, opp, side: h.color, result: h.result, kills: h.kills,
        deaths: h.deaths, assists: h.assists, gold: h.gold, towers: o[0], inh: o[1], barons: o[2], dragons: o[3], heralds: o[4], min });
    }
    qa(sec, ".submatch-lol-main .submatch-lol-player").forEach(p => {
      const s = idx(p, "side"), r = idx(p, "row"), h = heads[s] || {};
      const perks = qa(p, ".submatch-lol-player-perks img").map(i => clean(i.getAttribute("alt"))),
        spells = qa(p, ".submatch-lol-player-spells img").map(i => clean(i.getAttribute("alt"))),
        ci = q(p, ".submatch-lol-player-champion img"), gold = q(p, ".submatch-lol-player-networth"),
        [k, d, a] = kda(T(q(p, ".submatch-lol-player-kda"))),
        items = qa(p, ".submatch-lol-player-items img").map(i => clean(i.getAttribute("alt")));
      const champ = ci ? clean(ci.getAttribute("alt")) : "";
      icon(champ, ci);
      out.players.push({ match: name, group, matchday, game: gno, team: h.team || "", side: colorOf(p), role: ROLES[r - 1] || "",
        player: T(q(p, ".submatch-lol-player-name")), account: acctId(p), champion: champ, level: num(T(q(p, ".player-hero-level"))), kills: k, deaths: d,
        assists: a, cs: num(T(q(p, ".submatch-lol-player-minions"))), gold: gold ? num(gold.getAttribute("title") || T(gold)) : null,
        result: h.result || "", keystone: perks[0] || "", tree: perks[1] || "", spell1: spells[0] || "", spell2: spells[1] || "",
        items: [0, 1, 2, 3, 4, 5, 6].map(i => items[i] || "") });
    });
  }
  out.match.games = out.games.length; out.v = 2;
  return out;
}

function buildWorkbook(results, icons) {
  const wb = XLSX.utils.book_new();
  const add = (name, head, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...rows]), name);
  const all = k => results.flatMap(r => r[k]);
  const nG = all("games").length || 1, cnt = { Pick: {}, Ban: {} };
  all("drafts").forEach(d => { cnt[d.type][d.champion] = (cnt[d.type][d.champion] || 0) + 1; });
  ["Pick", "Ban"].forEach(t => {
    const rows = Object.entries(cnt[t]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, n]) => [c, n, n / nG]);
    add(t + "s", ["Champion", t + "s", t + " rate (per game)"], rows);
    rows.forEach((_, i) => { wb.Sheets[t + "s"]["C" + (i + 2)].z = "0.0%"; });
  });
  add("Matches", ["Match ID", "Group", "Matchday", "Date", "Team 1", "Team 2", "Score", "Format", "Games parsed", "URL"],
    results.map(r => { const m = r.match; return [m.id, m.group, m.matchday, m.date, m.team1, m.team2, m.score, m.format, m.games, m.url]; }));
  add("Games", ["Match", "Group", "Matchday", "Date", "Game", "Game ID", "Blue side", "Red side", "Winner", "Duration (min)", "Created", "Start", "End"],
    all("games").map(g => [g.match, g.group, g.matchday, g.date, g.game, g.gameId, g.blue, g.red, g.winner, g.min, g.created, g.start, g.end]));
  add("TeamGames", ["Match", "Group", "Matchday", "Game", "Team", "Opponent", "Side", "Result", "Kills", "Deaths", "Assists", "Gold", "Towers", "Inhibitors", "Barons", "Dragons", "Heralds", "Duration (min)"],
    all("tgs").map(t => [t.match, t.group, t.matchday, t.game, t.team, t.opp, t.side, t.result, t.kills, t.deaths, t.assists, t.gold, t.towers, t.inh, t.barons, t.dragons, t.heralds, t.min]));
  add("Players", ["Match", "Group", "Matchday", "Game", "Team", "Side", "Role (by row)", "Player", "Champion", "Level", "Kills", "Deaths", "Assists", "CS", "Gold", "Result", "Keystone", "Rune tree", "Spell 1", "Spell 2", "Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6", "Item 7", "Account ID"],
    all("players").map(p => [p.match, p.group, p.matchday, p.game, p.team, p.side, p.role, p.player, p.champion, p.level, p.kills, p.deaths, p.assists, p.cs, p.gold, p.result, p.keystone, p.tree, p.spell1, p.spell2, ...p.items, p.account || ""]));
  add("Draft", ["Match", "Group", "Matchday", "Game", "Draft order", "Type", "Champion", "Side", "Team"],
    all("drafts").map(d => [d.match, d.group, d.matchday, d.game, d.order, d.type, d.champion, d.side, d.team]));
  add("Icons", ["Champion", "Image"], Object.entries(icons || {}).sort((a, b) => a[0].localeCompare(b[0])));
  return wb;
}
