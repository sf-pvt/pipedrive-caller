// Pipedrive list dialer: a call console docked to the right of any Pipedrive list view.
// Start calling -> reads the rows on screen -> shows the record and its history -> dials ->
// you log the outcome and a note -> next.

(() => {
  if (window.__pddLoaded) return;
  window.__pddLoaded = true;

  const LIST_RE = /\/(leads\/(inbox|archived)|deals(\/|$)|persons\/list|organizations\/list)/;
  const OUTCOMES = [
    { key: "1", label: "Answered", type: "call___discussion", leadLabel: "Contacted - Discussion", cls: "green" },
    { key: "2", label: "No answer", type: "call___no_answer", leadLabel: "Contacted - No answer", cls: "" },
    { key: "3", label: "Busy", type: "call___busy", leadLabel: null, cls: "amber" },
    { key: "4", label: "Gatekeeper", type: "call___gatekeeper", leadLabel: "Contacted - Gatekeeper", cls: "blue" },
    { key: "5", label: "Not interested", type: "call___discussion", leadLabel: "Contacted - Not interested", cls: "red" },
  ];
  const MEETING = { key: "6", label: "Meeting booked", cls: "book" };
  // Where a booked meeting's deal goes. Set in the settings; if empty, the first stage whose name
  // contains "meeting booked" in the account's first pipeline is used.
  // Website screenshots come from thum.io. A paid key (settings > Screenshot key) removes the
  // free tier's limits; without one the free tier is used.
  const SHOT = (site) => `https://image.thum.io/get/${settings.thumKey ? "auth/" + settings.thumKey + "/" : ""}width/800/crop/450/noanimate/https://${site}`;
  const FREEMAIL = /^(gmail|hotmail|outlook|live|yahoo|icloud|me|msn|aol|protonmail|proton|gmx|mail|yandex|suomi24|luukku|elisanet|kolumbus|pp|saunalahti)\./i;

  const settings = { scheme: "tel", preview: 5, setLabel: true, testNumber: "", autoDial: true, userId: null, userName: "", thumKey: "", bookPipeline: null, bookStage: null };
  const state = { queue: [], i: -1, phase: "idle", timer: null, countdown: 0, run: 0, leadLabels: null, orgSiteKeys: null, orgPhoneKeys: [], stages: null };
  let panel, els;

  // After the extension is reloaded, this copy of the script is orphaned: every chrome.* call
  // throws "Extension context invalidated". Detect it once, remove the panel and go quiet.
  let dead = false;
  function teardown() {
    if (dead) return; dead = true;
    try { clearInterval(ticker); } catch (e) {}
    try { if (state.timer) clearInterval(state.timer); } catch (e) {}
    try { unhighlight(); } catch (e) {}
    try { if (panel) panel.remove(); } catch (e) {}
    panel = null; window.__pddLoaded = false;
  }
  const invalidated = (e) => /context invalidated|Extension context/i.test(String(e && e.message || e));
  const send = (msg) => { if (dead) return Promise.resolve({ ok: false, error: "Extension was reloaded. Refresh this page." }); try { return chrome.runtime.sendMessage(msg).catch((e) => { if (invalidated(e)) teardown(); return { ok: false, error: String(e) }; }); } catch (e) { if (invalidated(e)) teardown(); return Promise.resolve({ ok: false, error: "Extension was reloaded. Refresh this page." }); } };
  const api = (path, opts = {}) => send({ kind: "api", path, ...opts });
  const store = {
    get: (k) => { if (dead) return Promise.resolve({}); try { return chrome.storage.local.get(k).catch((e) => { if (invalidated(e)) teardown(); return {}; }); } catch (e) { if (invalidated(e)) teardown(); return Promise.resolve({}); } },
    set: (v) => { if (dead) return Promise.resolve(); try { return chrome.storage.local.set(v).catch((e) => { if (invalidated(e)) teardown(); }); } catch (e) { if (invalidated(e)) teardown(); return Promise.resolve(); } },
  };
  const assetUrl = (p) => { try { return chrome.runtime.getURL(p); } catch (e) { if (invalidated(e)) teardown(); return ""; } };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- reading the list ----------
  function kind() {
    const p = location.pathname;
    if (p.startsWith("/leads")) return "lead";
    if (p.startsWith("/deals")) return "deal";
    if (p.startsWith("/persons")) return "person";
    if (p.startsWith("/organizations")) return "organization";
    return null;
  }

  function headers(cellCount) {
    const head = document.querySelector('[role="grid"] [role="row"], table thead tr');
    if (!head) return [];
    const byChild = [...head.children].map((c) => c.textContent.trim());
    if (byChild.length === cellCount) return byChild;
    const byRole = [...document.querySelectorAll('[role="columnheader"], table thead th')].map((c) => c.textContent.trim());
    if (byRole.length === cellCount) return byRole;
    return byRole.length ? byRole : byChild.filter(Boolean);
  }

  const cleanPhone = (s) => (s || "").replace(/^(callto|tel|facetime-audio|facetime):/i, "").replace(/[^\d+]/g, "");

  const CCS = ["358", "351", "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98", "212", "213", "216", "218", "234", "254", "353", "354", "356", "357", "370", "371", "372", "373", "374", "375", "376", "377", "378", "380", "381", "385", "386", "387", "389", "420", "421", "423", "852", "853", "855", "856", "880", "886", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977", "992", "993", "994", "995", "996", "998"];
  function groupDigits(d) {
    // groups of three from the right; a final group of four when that divides better
    if (d.length <= 4) return d;
    const parts = []; let tail = d;
    if (tail.length % 3 === 1) { parts.unshift(tail.slice(-4)); tail = tail.slice(0, -4); }
    while (tail.length > 3) { parts.unshift(tail.slice(-3)); tail = tail.slice(0, -3); }
    if (tail) parts.unshift(tail);
    return parts.join(" ");
  }
  function prettyPhone(raw, text) {
    // keep the text as typed when it already has separators
    if (text && /\d/.test(text) && /[\s\-()]/.test(text.trim())) return text.trim();
    const src = (text && /\d/.test(text)) ? text.trim() : raw;
    const d = src.replace(/\D/g, "");
    if (!d) return raw;
    if (src.trim().startsWith("+") || src.trim().startsWith("00")) {
      const digits = src.trim().startsWith("00") ? d.slice(2) : d;
      const cc = [3, 2, 1].map((n) => digits.slice(0, n)).find((c) => CCS.includes(c)) || digits.slice(0, 2);
      return "+" + cc + " " + groupDigits(digits.slice(cc.length));
    }
    return d.length > 6 ? d.slice(0, 3) + " " + groupDigits(d.slice(3)) : d;
  }
  // Other extensions (Ringover) rewrite any phone number they find in the page text. Drawing the
  // number with a CSS pseudo-element keeps it out of the DOM text, so they leave it alone.
  const phoneEl = (raw, text) => `<span class="pdd-num" data-num="${esc(prettyPhone(raw, text))}"></span>`;

  // The deals list is not a real grid: find each deal link and walk up to the element that sits
  // next to other deal rows. Works for the list view and, column by column, for the kanban.
  function rowOf(link) {
    let el = link;
    while (el.parentElement && el.parentElement !== document.body) {
      const p = el.parentElement;
      const sibs = [...p.children];
      if (sibs.length >= 3 && sibs.filter((x) => x.querySelector('a[href^="/deal/"], a[href^="/person/"], a[href^="/organization/"]')).length >= 3) return el;
      el = p;
    }
    return link.closest('tr,[role="row"]') || link.parentElement;
  }

  function linkRows(prefix) {
    const seen = new Set(); const rows = [];
    for (const a of document.querySelectorAll(`a[href^="${prefix}"]`)) {
      const r = rowOf(a);
      if (!r || seen.has(r) || (panel && panel.contains(r))) continue;
      seen.add(r); rows.push(r);
    }
    return rows;
  }

  function readRows() {
    let rows = [...document.querySelectorAll('[role="grid"] [role="rowgroup"] [role="row"]')];
    if (!rows.length) rows = [...document.querySelectorAll("table tbody tr")];
    if (!rows.length && kind() === "deal") rows = linkRows("/deal/");
    if (!rows.length && kind() === "person") rows = linkRows("/person/");
    if (!rows.length && kind() === "organization") rows = linkRows("/organization/");
    const out = [];
    const hdr = rows.length ? headers(rows[0].children.length) : [];
    for (const row of rows) {
      const cells = [...row.children];
      const fields = {};
      cells.forEach((c, idx) => {
        const name = hdr[idx] || "col" + idx;
        const t = c.textContent.trim();
        if (name && t) fields[name] = t;
      });
      const phoneLink = row.querySelector('a[href^="callto:"], a[href^="tel:"]');
      let phone = phoneLink ? cleanPhone(phoneLink.getAttribute("href")) : "";
      let phoneText = phoneLink ? phoneLink.textContent : "";
      if (!phone) {
        const m = (fields.Phone || fields.Telephone || "").match(/\+?[\d\s\-()]{7,}/);
        if (m) { phone = cleanPhone(m[0]); phoneText = m[0]; }
      }
      const idLink = row.querySelector('a[href*="/deal/"], a[href*="/person/"], a[href*="/organization/"], a[href*="/leads/"]');
      let id = null, rowKind = kind();
      if (idLink) {
        const m = idLink.getAttribute("href").match(/\/(deal|person|organization|leads)\/([\w-]+)/);
        if (m) { id = m[2]; rowKind = m[1] === "leads" ? "lead" : m[1]; }
      }
      if (!id) {
        const attr = [...row.attributes].map((a) => a.value).find((v) => /^[0-9a-f-]{36}$/.test(v) || /^\d{3,}$/.test(v));
        if (attr) id = attr;
      }
      if (!phone) {
        const m = row.textContent.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{2,4}[\s-]?\d{2,4}(?:[\s-]?\d{2,4})?/);
        if (m && m[0].replace(/\D/g, "").length >= 7 && !/\d{4}-\d{2}-\d{2}/.test(m[0])) { phone = cleanPhone(m[0]); phoneText = m[0]; }
      }
      const title = (idLink && idLink.textContent.trim()) || fields.Title || fields.Name || fields.Deal || cells.map((c) => c.textContent.trim()).find((t) => t && !/^on$/.test(t)) || "(no title)";
      out.push({ title, phone, phoneText, id, kind: rowKind, fields, row });
    }
    return out;
  }

  // ---------- Pipedrive data ----------
  async function phoneFromApi(item) {
    try {
      if (item.kind === "deal") {
        const r = await api("/deals/" + item.id);
        if (!r.ok) return;
        const d = r.data;
        item.personId = d.person_id && d.person_id.value; item.orgId = d.org_id && d.org_id.value;
        item.person = d.person_id && d.person_id.name; item.org = d.org_id && d.org_id.name;
        item.owner = d.user_id && d.user_id.name; item.value = d.value ? d.value + " " + d.currency : null;
        item.stageId = d.stage_id;
        const ph = ((d.person_id && d.person_id.phone) || []).map((p) => p.value).filter((v) => v && v !== "none" && /\d{5,}/.test(v));
        if (ph[0]) { item.phone = cleanPhone(ph[0]); item.phoneText = ph[0]; }
        if (!item.phone && item.orgId) {
          const o = await api("/organizations/" + item.orgId);
          const f = o.ok && Object.values(o.data).find((v) => typeof v === "string" && /^\+?[\d\s()-]{7,}$/.test(v));
          if (f) { item.phone = cleanPhone(f); item.phoneText = f; }
        }
      } else if (item.kind === "person") {
        const r = await api("/persons/" + item.id);
        if (!r.ok) return;
        item.personId = Number(item.id); item.person = r.data.name;
        const ph = (r.data.phone || []).map((p) => p.value).filter((v) => v && v !== "none");
        if (ph[0]) { item.phone = cleanPhone(ph[0]); item.phoneText = ph[0]; }
      }
    } catch (e) { /* leave without phone */ }
  }

  async function pageAll(path, params, cap = 300) {
    const out = []; let start = 0;
    while (out.length < cap) {
      const r = await api(path, { params: { ...params, start, limit: 100 } });
      if (!r.ok || !r.data) break;
      out.push(...r.data);
      const pg = r.additional && r.additional.pagination;
      if (!pg || !pg.more_items_in_collection) break;
      start = pg.next_start;
    }
    return out;
  }

  const strip = (h) => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  async function enrich(item) {
    if (item.enrichedDone) return;
    item.enriched = true;
    try {
      if (!item.id && item.kind === "lead") {
        const r = await api("/leads/search", { params: { term: item.title, fields: "title", exact_match: true, limit: 1 } });
        const hit = r.ok && r.data && r.data.items && r.data.items[0];
        if (hit) { item.id = hit.item.id; item.personId = hit.item.person && hit.item.person.id; item.orgId = hit.item.organization && hit.item.organization.id; }
      }
      if (!item.id) return;
      if (item.kind === "lead") {
        const r = await api("/leads/" + item.id);
        if (r.ok) { item.personId = r.data.person_id; item.orgId = r.data.organization_id; item.labelIds = r.data.label_ids || []; item.addTime = r.data.add_time; }
      } else if (item.kind === "deal") {
        const r = await api("/deals/" + item.id);
        if (r.ok) { item.personId = r.data.person_id && r.data.person_id.value; item.orgId = r.data.org_id && r.data.org_id.value; item.owner = r.data.user_id && r.data.user_id.name; item.value = r.data.value ? r.data.value + " " + r.data.currency : null; item.stageId = r.data.stage_id; item.addTime = r.data.add_time; }
      } else if (item.kind === "person") item.personId = Number(item.id);
      else if (item.kind === "organization") item.orgId = Number(item.id);

      if (item.stageId) { await loadStages(); const st = state.stages.find((x) => x.id === item.stageId); if (st) item.stageName = st.name; }

      if (item.personId) {
        const r = await api("/persons/" + item.personId);
        if (r.ok) {
          item.person = r.data.name;
          item.phones = (r.data.phone || []).map((p) => p.value).filter((v) => v && v !== "none");
          item.emails = (r.data.email || []).map((e) => e.value).filter(Boolean);
          item.jobTitle = r.data.job_title;
          if (!item.orgId && r.data.org_id) item.orgId = r.data.org_id.value;
          if (!item.phone && item.phones[0]) { item.phone = cleanPhone(item.phones[0]); item.phoneText = item.phones[0]; }
        }
      }
      if (item.orgId) {
        const r = await api("/organizations/" + item.orgId);
        if (r.ok) {
          item.org = r.data.name; item.address = r.data.address; item.people = r.data.people_count;
          await loadOrgSiteKeys();
          for (const k of state.orgSiteKeys) { const v = r.data[k]; if (v && typeof v === "string" && /\./.test(v)) { item.website = v; break; } }
        }
      }
      await collectNumbers(item);
      if (!item.website) {
        const mail = (item.emails && item.emails[0]) || item.fields.Email || "";
        const dom = (mail.split("@")[1] || "").toLowerCase().trim();
        if (dom && !FREEMAIL.test(dom)) item.website = dom;
      }
      if (item.website) item.website = item.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

      // history: every note plus the activities, newest first
      const noteParams = item.kind === "lead" ? { lead_id: item.id } : item.kind === "deal" ? { deal_id: item.id } : item.kind === "person" ? { person_id: item.id } : { org_id: item.id };
      const notes = await pageAll("/notes", { ...noteParams, sort: "add_time DESC" });
      const events = notes.map((n) => ({ when: n.add_time || "", kind: "note", who: (n.user && n.user.name) || "", title: "Note", text: strip(n.content) }));
      let actPath = null;
      if (item.kind === "deal") actPath = `/deals/${item.id}/activities`;
      else if (item.kind === "person") actPath = `/persons/${item.id}/activities`;
      else if (item.kind === "organization") actPath = `/organizations/${item.id}/activities`;
      else if (item.personId) actPath = `/persons/${item.personId}/activities`;
      if (actPath) {
        const acts = await pageAll(actPath, {}, 200);
        for (const a of acts) events.push({ when: (a.marked_as_done_time || (a.due_date + (a.due_time ? " " + a.due_time : " 00:00")) || ""), kind: /call/.test(a.type) ? "call" : /meeting/.test(a.type) ? "meeting" : /email/.test(a.type) ? "email" : "task", who: a.owner_name || "", title: (a.subject || a.type || "").replace(/_/g, " "), text: strip(a.note), done: !!a.done, due: a.due_date });
      }
      events.sort((a, b) => (b.when || "").localeCompare(a.when || ""));
      item.events = events;
    } catch (e) { item.enrichError = String(e); }
    item.enrichedDone = true;
  }

  const isPhone = (v) => typeof v === "string" && /\d{5,}/.test(v) && /^[+\d\s()./-]{6,}$/.test(v.trim());
  async function collectNumbers(item) {
    const seen = new Set(); const out = [];
    const push = (value, who, label, personId, title) => { const num = cleanPhone(value); if (!num || num.replace(/\D/g, "").length < 6 || seen.has(num)) return; seen.add(num); out.push({ num, text: value.trim(), who, label: (label || "").trim(), personId, title: title || "" }); };
    if (item.personId) {
      const r = await api("/persons/" + item.personId);
      if (r.ok) for (const p of r.data.phone || []) if (p.value && p.value !== "none") push(p.value, r.data.name, p.label, r.data.id, r.data.job_title);
    }
    if (item.orgId) {
      const ppl = await api(`/organizations/${item.orgId}/persons`, { params: { limit: 10 } });
      if (ppl.ok && ppl.data) for (const p of ppl.data) if (p.id !== item.personId) for (const ph of p.phone || []) if (ph.value && ph.value !== "none") push(ph.value, p.name, ph.label, p.id, p.job_title);
      const o = await api("/organizations/" + item.orgId);
      await loadOrgSiteKeys();
      if (o.ok) for (const k of state.orgPhoneKeys) { const v = o.data[k]; if (isPhone(v)) push(v, o.data.name, "company", null); }
    }
    if (item.phone && !seen.has(item.phone)) out.unshift({ num: item.phone, text: item.phoneText || item.phone, who: item.person || "", label: "", personId: item.personId, title: item.jobTitle || "" });
    item.numbers = out;
    if (!item.phone && out[0]) pickNumber(item, out[0], false);
  }

  function pickNumber(item, n, rerender = true) {
    item.phone = n.num; item.phoneText = n.text;
    if (n.personId) { item.personId = n.personId; item.person = n.who; item.jobTitle = n.title || ""; }
    if (rerender) { renderCard(item); renderNextLine(); if (state.phase === "calling" || state.phase === "preview" || state.phase === "paused") dial(state.phase === "calling"); }
  }

  async function loadOrgSiteKeys() {
    if (state.orgSiteKeys) return;
    const r = await api("/organizationFields");
    const keys = ["website"], phones = [];
    if (r.ok) for (const f of r.data) {
      if (/^(website|company domain name)/i.test(f.name) && f.key !== "website") keys.push(f.key);
      if (/phone|puhelin|tel[eé]fono|switchboard|vaihde/i.test(f.name) && f.field_type !== "int") phones.push(f.key);
    }
    state.orgSiteKeys = keys; state.orgPhoneKeys = phones;
  }
  async function loadStages() { if (state.stages) return; const r = await api("/stages"); state.stages = r.ok ? r.data : []; }
  async function bookTarget() {
    await loadStages();
    if (settings.bookStage) { const st = state.stages.find((x) => x.id === Number(settings.bookStage)); if (st) return { pipeline_id: st.pipeline_id, stage_id: st.id }; }
    const st = state.stages.find((x) => /meeting booked/i.test(x.name)) || state.stages[0];
    return st ? { pipeline_id: st.pipeline_id, stage_id: st.id } : {};
  }
  async function loadLeadLabels() { if (state.leadLabels) return; const r = await api("/leadLabels"); state.leadLabels = r.ok ? Object.fromEntries(r.data.map((l) => [l.name, l.id])) : {}; }

  async function logOutcome(item, outcome, note) {
    const today = new Date().toISOString().slice(0, 10);
    const body = { subject: outcome.label + ": " + (item.org || item.title), type: outcome.type, done: 1, due_date: today, note: note || "", user_id: settings.userId || undefined };
    if (item.kind === "lead" && item.id) body.lead_id = item.id;
    if (item.kind === "deal" && item.id) body.deal_id = Number(item.id);
    if (item.personId) body.person_id = item.personId;
    if (item.orgId) body.org_id = item.orgId;
    if (!body.lead_id && !body.deal_id && !body.person_id && !body.org_id) return { ok: false, error: "Could not match this row to a Pipedrive record, so nothing was logged." };
    let r = await api("/activities", { method: "POST", body });
    if (!r.ok && /type/i.test(r.error || "")) { body.type = "call"; r = await api("/activities", { method: "POST", body }); }
    if (r.ok && settings.setLabel && item.kind === "lead" && item.id && outcome.leadLabel) {
      await loadLeadLabels();
      const labelId = state.leadLabels[outcome.leadLabel];
      if (labelId) await api("/leads/" + item.id, { method: "PATCH", body: { label_ids: [labelId] } });
    }
    return r;
  }

  // ---------- screenshots ----------
  const shotCache = new Map();
  function loadShot(site) {
    if (!site) return Promise.resolve(null);
    if (!shotCache.has(site)) shotCache.set(site, send({ kind: "image", url: SHOT(site) }).then((r) => (r && r.ok && !/gif/.test(r.type) ? r.dataUrl : null)).catch(() => null));
    return shotCache.get(site);
  }

  // ---------- UI ----------
  function build() {
    if (panel) return;
    panel = document.createElement("aside");
    panel.id = "pdd-panel";
    panel.innerHTML = `
      <header class="pdd-top">
        <div class="pdd-brand"><img src="${assetUrl("icons/icon48.png")}" alt=""><span>Dialer</span></div>
        <div class="pdd-state" data-r="state">Ready</div>
        <div class="pdd-top-actions">
          <button class="pdd-ib pdd-hist" data-r="hist" title="Show history in a side column">History ▸</button>
          <button class="pdd-ib" data-r="settings" title="Settings">⚙</button>
          <button class="pdd-ib" data-r="min" title="Minimize">–</button>
        </div>
      </header>
      <button class="pdd-pill" data-r="pill" title="Open the dialer"><img src="${assetUrl("icons/icon48.png")}" alt=""><span data-r="pillstate">Dialer</span><b data-r="pillcount"></b></button>
      <div class="pdd-progress"><div data-r="fill"></div></div>
      <div class="pdd-control">
        <button class="pdd-btn go" data-r="start">Start calling</button>
        <div class="pdd-mode" data-r="mode" title="Dial mode">
          <button data-m="auto">Auto</button><button data-m="manual">Manual</button>
        </div>
        <div class="pdd-count" data-r="count"></div>
      </div>
      <div class="pdd-columns">
      <div class="pdd-main" data-r="main">
      <div class="pdd-body" data-r="body">
        <div class="pdd-idle" data-r="idle"></div>
        <div class="pdd-contact" data-r="card" hidden></div>
        <section class="pdd-timeline" data-r="timeline" hidden></section>
      </div>
      <footer class="pdd-foot" data-r="foot" hidden>
        <textarea class="pdd-note" data-r="note" placeholder="Note for this call: what was said, next step…"></textarea>
        <div class="pdd-actions" data-r="actions"></div>
        <div class="pdd-next" data-r="nextline"></div>
        <div class="pdd-err" data-r="err"></div>
        <div class="pdd-hint" data-r="hint"></div>
      </footer>
      </div>
      <aside class="pdd-side" data-r="side"><div class="pdd-sidehead"><span>History</span><button class="pdd-ib pdd-hist" data-r="collapse" title="Put the history back under the record">◂ Collapse</button></div><div data-r="sidebody"></div></aside>
      </div>`;
    document.body.appendChild(panel);
    els = Object.fromEntries([...panel.querySelectorAll("[data-r]")].map((e) => [e.dataset.r, e]));
    els.start.addEventListener("click", onStartPause);
    els.settings.addEventListener("click", () => send({ kind: "openOptions" }));
    els.min.addEventListener("click", () => panel.classList.add("pdd-min"));
    const toggleWide = async () => { setWide(!panel.classList.contains("pdd-wide")); await store.set({ wide: panel.classList.contains("pdd-wide") }); };
    els.hist.addEventListener("click", toggleWide);
    els.collapse.addEventListener("click", toggleWide);
    store.get("wide").then((v) => setWide(v.wide !== false)); // wide by default
    for (const b of els.mode.querySelectorAll("[data-m]")) b.addEventListener("click", async () => {
      settings.autoDial = b.dataset.m === "auto";
      await store.set({ autoDial: settings.autoDial });
      renderMode();
      if (state.phase === "preview") startPreview();
    });
    store.get("autoDial").then((v) => { settings.autoDial = v.autoDial !== false; renderMode(); });
    els.pill.addEventListener("click", () => panel.classList.remove("pdd-min"));
    document.addEventListener("keydown", onKey, true);
    renderIdle();
  }

  function onKey(e) {
    if (dead) { document.removeEventListener("keydown", onKey, true); return; }
    if (!panel || state.phase === "idle" || state.phase === "done" || state.phase === "loading") return;
    const typing = panel.contains(e.target) && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === "Escape") { if (state.phase === "preview" || state.phase === "calling") { e.preventDefault(); pause(); } return; }
    if (typing) return;
    if (e.key === "Enter") { e.preventDefault(); dial(state.phase === "calling"); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); next(); return; }
    if (state.phase === "calling") {
      if (e.key === MEETING.key) { e.preventDefault(); openMeetingForm(); return; }
      const o = OUTCOMES.find((x) => x.key === e.key); if (o) { e.preventDefault(); finish(o); }
    }
  }

  function renderIdle() {
    const rows = readRows();
    const withPhone = rows.filter((r) => r.phone).length;
    els.idle.innerHTML = rows.length
      ? `<h3>${rows.length} rows on this page</h3>
         <ul class="pdd-tips">
           <li>${withPhone ? `${withPhone} already show a phone number` : "Phone numbers are read from Pipedrive on start"}</li>
           <li>Called in the order shown, top to bottom</li>
           <li>Scroll the list first to load more rows</li>
           <li><kbd>Esc</kbd> pauses at any time</li>
         </ul>
         <p class="pdd-callout" data-r="whoami"></p>`
      : `<h3>No list rows found</h3><ul class="pdd-tips"><li>Open a list view with rows on screen</li><li>For example the Leads Inbox with a filter, or a deals list</li></ul>`;
    els.count.innerHTML = rows.length ? `<b>${rows.length}</b> rows` : "";
    els.pillcount.textContent = "";
    els.fill.style.width = "0";
    els.idle.hidden = false; els.card.hidden = true; els.timeline.hidden = true; els.foot.hidden = true;
    store.get(["testNumber", "userName", "apiToken"]).then((t) => {
      if (!panel) return;
      const on = !!(t.testNumber || "").trim();
      panel.classList.toggle("pdd-test", on); setState(on ? "Test mode" : "Ready", on ? "test" : "");
      const w = els.idle.querySelector("[data-r=whoami]");
      if (w) { const ok = t.apiToken && t.userName; w.className = "pdd-callout" + (ok ? "" : " warn"); w.innerHTML = ok ? `Logging calls as <b>${esc(t.userName)}</b> · <a href="#" data-r="openset">change</a>` : `<b>Set up first.</b> Open settings, paste the team token and pick your name.`; const a = w.querySelector("[data-r=openset]"); if (a) a.addEventListener("click", (e) => { e.preventDefault(); send({ kind: "openOptions" }); }); }
    });
  }

  function updateCount() {
    if (!els || state.phase === "idle") return;
    const n = Math.min(state.i + 1, state.queue.length);
    els.count.innerHTML = `<b>${n}</b> / ${state.queue.length}`;
    els.pillcount.textContent = `${n}/${state.queue.length}`;
    els.fill.style.width = Math.round(100 * n / Math.max(1, state.queue.length)) + "%";
  }

  function setWide(on) {
    panel.classList.toggle("pdd-wide", on);
    els.hist.hidden = on; // the header button only re-opens the column; closing lives in the column itself
    // wide: history in the side column, note and outcomes full width under both columns
    if (on) { els.sidebody.appendChild(els.timeline); panel.appendChild(els.foot); }
    else { els.body.appendChild(els.timeline); els.main.appendChild(els.foot); }
  }

  function renderMode() {
    for (const b of els.mode.querySelectorAll("[data-m]")) b.classList.toggle("on", (b.dataset.m === "auto") === settings.autoDial);
    els.mode.title = settings.autoDial ? "Auto: dials after the countdown" : "Manual: you press Call for each record";
  }

  function setState(text, tone) { els.state.textContent = text; els.state.className = "pdd-state " + (tone || ""); els.pillstate.textContent = text; els.pill.className = "pdd-pill " + (tone || ""); }

  const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const initials = (s) => s.split(/[\s\-\/]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

  function renderCard(item) {
    const link = item.id ? (item.kind === "lead" ? `/leads/inbox/${item.id}` : `/${item.kind}/${item.id}`) : null;
    const name = item.org || item.title;
    const labels = (item.fields.Labels || "").split(/(?<=[a-z])(?=[A-Z])/).filter(Boolean);
    const kv = (k, v, wide) => (v ? `<div class="pdd-kv${wide ? " wide" : ""}"><b>${esc(k)}</b><span title="${esc(v)}">${esc(v)}</span></div>` : "");
    const extra = Object.entries(item.fields).filter(([k]) => !/^(Title|Name|Phone|Email|Labels|Person|Organization|Owner|Stage|Pipeline|col\d+)$/.test(k)).slice(0, 4);
    const nums = item.numbers || [];
    const cur = nums.find((n) => n.num === item.phone);
    els.card.innerHTML = `
      <div class="pdd-who">
        <div class="pdd-avatar" style="background:hsl(${hue(name)} 55% 45%)">${esc(initials(name))}</div>
        <div class="pdd-name">
          <h2>${link ? `<a href="${link}" target="_blank" title="Open in Pipedrive">${esc(name)}</a>` : esc(name)}</h2>
          <p>${esc([item.person || item.fields.Person, item.jobTitle].filter(Boolean).join(" · ") || (item.org && item.title !== item.org ? item.title : "") || "no contact person")}</p>
          <div class="pdd-tags">${item.stageName ? `<span class="pdd-tag stage">${esc(item.stageName)}</span>` : ""}${labels.map((l) => `<span class="pdd-tag">${esc(l)}</span>`).join("")}</div>
        </div>
      </div>
      <div class="pdd-phonebox">
        <div class="pdd-phonemain">
          <button class="pdd-phone" data-dial title="Call this number">${item.phone ? phoneEl(item.phone, item.phoneText) : "no phone"}</button>
          ${cur ? `<div class="pdd-phonewho">${esc([cur.who, cur.title, cur.label].filter(Boolean).join(" · "))}</div>` : ""}
        </div>
        ${nums.length > 1 ? `<button class="pdd-mini" data-pick title="Choose another number to call">${nums.length} numbers ▾</button>` : ""}
        ${item.phone ? `<button class="pdd-mini" data-copy="${esc(item.phone)}">Copy</button>` : ""}
      </div>
      ${nums.length > 1 ? `<div class="pdd-numlist" data-numlist hidden>${nums.map((n, i) => `<button data-n="${i}" class="${n.num === item.phone ? "on" : ""}"><span class="pdd-num" data-num="${esc(prettyPhone(n.num, n.text))}"></span><small>${esc(n.who)}${n.title ? ` <i>${esc(n.title)}</i>` : ""}${n.label ? ` · ${esc(n.label)}` : ""}</small></button>`).join("")}</div>` : ""}
      <div class="pdd-shot" data-shot></div>
      <div class="pdd-meta">
        ${kv("Email", (item.emails && item.emails[0]) || item.fields.Email, true)}
        ${kv("Owner", item.owner || item.fields.Owner)}
        ${kv("Value", item.value)}
        ${kv("Address", item.address, true)}
        ${extra.map(([k, v]) => kv(k, v)).join("")}
      </div>`;
    els.card.hidden = false;
    const pick = els.card.querySelector("[data-pick]"), list = els.card.querySelector("[data-numlist]");
    if (pick && list) {
      pick.addEventListener("click", () => { list.hidden = !list.hidden; });
      for (const b of list.querySelectorAll("[data-n]")) b.addEventListener("click", () => pickNumber(item, nums[Number(b.dataset.n)]));
    }
    const dialBtn = els.card.querySelector("[data-dial]");
    if (dialBtn) dialBtn.addEventListener("click", () => { if (state.phase !== "idle" && state.phase !== "done") dial(state.phase === "calling"); });
    const copy = els.card.querySelector("[data-copy]");
    if (copy) copy.addEventListener("click", () => { navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = "Copied"; setTimeout(() => (copy.textContent = "Copy"), 1200); });
    renderShot(item);
    renderTimeline(item);
  }

  function renderShot(item) {
    const box = els.card.querySelector("[data-shot]");
    if (!box) return;
    if (!item.website) { box.innerHTML = `<div class="pdd-shot-empty">no website found</div>`; return; }
    box.innerHTML = `<a href="https://${esc(item.website)}" target="_blank" title="Open ${esc(item.website)}"><div class="pdd-shot-empty">loading ${esc(item.website)}…</div></a>`;
    loadShot(item.website).then((src) => {
      if (state.queue[state.i] !== item) return;
      const a = box.querySelector("a"); if (!a) return;
      a.innerHTML = src ? `<img src="${src}" alt=""><span class="pdd-shot-cap">${esc(item.website)} ↗</span>` : `<div class="pdd-shot-empty">${esc(item.website)} ↗<small>no screenshot</small></div>`;
    });
  }

  const ICON = { note: "✎", call: "✆", meeting: "◷", email: "✉", task: "✓" };
  function renderTimeline(item) {
    const ev = item.events;
    els.timeline.hidden = false;
    if (!ev) { els.timeline.innerHTML = `<h4>History</h4><div class="pdd-empty">Loading…</div>`; return; }
    if (!ev.length) { els.timeline.innerHTML = `<h4>History</h4><div class="pdd-empty">Nothing logged yet.</div>`; return; }
    const fmt = (w) => (w || "").slice(0, 10);
    els.timeline.innerHTML = `<h4>${panel.classList.contains("pdd-wide") ? "" : "History "}<span>${ev.length}</span></h4><ul class="pdd-tl">${ev.map((e, i) => `
      <li class="pdd-ev" data-i="${i}">
        <div class="ic ${e.kind}">${ICON[e.kind] || "•"}</div>
        <div><div class="hd"><b>${esc(e.title)}</b>${e.who ? `<span>${esc(e.who)}</span>` : ""}<time>${esc(fmt(e.when))}</time></div>
        ${e.text ? `<div class="tx">${esc(e.text)}</div>` : ""}</div>
      </li>`).join("")}</ul>`;
    for (const li of els.timeline.querySelectorAll(".pdd-ev")) {
      const tx = li.querySelector(".tx");
      if (tx && tx.scrollHeight > tx.clientHeight + 2) {
        const b = document.createElement("button"); b.className = "more"; b.textContent = "Show more";
        b.addEventListener("click", () => { li.classList.toggle("open"); b.textContent = li.classList.contains("open") ? "Show less" : "Show more"; });
        tx.after(b);
      }
    }
  }

  function renderNextLine() {
    const n = state.queue[state.i + 1];
    els.nextline.innerHTML = n
      ? `<b>Next</b><span>${esc(n.title)}${n.phone ? " · " + phoneEl(n.phone, n.phoneText) : ""}</span>`
      : `<b>Next</b><span>nobody, this is the last one</span>`;
  }

  function highlight(item) { unhighlight(); if (item.row) { item.row.classList.add("pdd-row-current"); state.hl = item.row; } }
  function unhighlight() { if (state.hl) { state.hl.classList.remove("pdd-row-current"); state.hl = null; } }

  function renderActions(phase) {
    els.actions.innerHTML = "";
    const add = (el) => els.actions.appendChild(el);
    const btn = (label, cls, fn, key) => { const b = document.createElement("button"); b.className = cls; b.innerHTML = esc(label) + (key ? ` <kbd>${key}</kbd>` : ""); b.addEventListener("click", fn); return b; };
    const nav = (...items) => { const d = document.createElement("div"); d.className = "pdd-nav"; d.style.flexBasis = "100%"; items.forEach((x) => d.appendChild(x)); return d; };
    if (phase === "preview") {
      const call = btn("Call now", "pdd-btn go pdd-cd", () => dial(), "↵"); call.innerHTML = `<i></i><span>${call.innerHTML}</span>`; call.dataset.cd = "1";
      add(nav(call, btn("Skip ›", "pdd-link", () => next())));
      els.hint.innerHTML = "<kbd>Esc</kbd> pauses · <kbd>→</kbd> skips";
    } else if (phase === "paused") {
      add(nav(btn("Resume", "pdd-btn go", () => resume()), btn("Call now", "pdd-btn soft", () => dial(), "↵"), btn("Skip ›", "pdd-link", () => next())));
      els.hint.innerHTML = "";
    } else if (phase === "calling") {
      for (const o of OUTCOMES) add(btn(o.label, "pdd-out " + o.cls, () => finish(o), o.key));
      add(btn(MEETING.label, "pdd-out " + MEETING.cls, () => openMeetingForm(), MEETING.key));
      add(nav(btn("Call again", "pdd-btn soft", () => dial(true), "↵"), btn("Next without logging ›", "pdd-link", () => next(), "→")));
      els.hint.innerHTML = "<kbd>1</kbd>–<kbd>6</kbd> log the outcome · <kbd>↵</kbd> calls again · <kbd>Esc</kbd> pauses";
    } else if (phase === "done") {
      add(nav(btn("Start again", "pdd-btn go", () => onStartPause())));
      els.hint.innerHTML = "";
    }
  }

  // ---------- flow ----------
  async function onStartPause() {
    if (state.phase === "idle" || state.phase === "done") {
      const s = await store.get(["apiToken", "scheme", "preview", "setLabel", "testNumber", "autoDial", "userId", "userName", "thumKey", "bookPipeline", "bookStage"]);
      if (!s.apiToken || !s.userId) { send({ kind: "openOptions" }); return; }
      Object.assign(settings, { scheme: s.scheme || "tel", preview: s.preview ?? 5, setLabel: s.setLabel !== false, testNumber: cleanPhone(s.testNumber || ""), autoDial: s.autoDial !== false, userId: s.userId, userName: s.userName || "", thumKey: (s.thumKey || "").trim(), bookPipeline: s.bookPipeline || null, bookStage: s.bookStage || null });
      panel.classList.toggle("pdd-test", !!settings.testNumber);
      let rows = readRows();
      const missing = rows.filter((r) => !r.phone && r.id && (r.kind === "deal" || r.kind === "person"));
      if (missing.length) {
        state.phase = "loading"; els.start.disabled = true;
        let done = 0;
        setState(`Reading phones 0/${missing.length}`, "");
        const work = missing.slice();
        await Promise.all(Array.from({ length: 6 }, async () => { while (work.length) { const r = work.shift(); await phoneFromApi(r); done += 1; setState(`Reading phones ${done}/${missing.length}`, ""); } }));
        els.start.disabled = false;
      }
      const total = rows.length;
      rows = rows.filter((r) => r.phone);
      if (!rows.length) { state.phase = "idle"; setState(total ? "No phone numbers" : "No rows", ""); els.idle.innerHTML = `<h3>${total ? `${total} rows, none with a phone number` : "No list rows found"}</h3><p>${total ? "Add a phone number to the contacts, or pick another list." : "Open a list view with rows on screen."}</p>`; return; }
      state.queue = rows; state.i = -1;
      els.idle.hidden = true; els.foot.hidden = false;
      next();
    } else if (state.phase === "preview" || state.phase === "calling") pause();
    else if (state.phase === "paused") resume();
  }

  function pause() {
    stopTimer();
    state.phase = "paused";
    els.start.textContent = "Resume"; els.start.className = "pdd-btn go";
    setState("Paused", "paused");
    renderActions("paused");
  }
  function resume() { if (state.phase === "paused") startPreview(); }
  function stopTimer() { state.run += 1; if (state.timer) { clearInterval(state.timer); state.timer = null; } }

  async function next() {
    stopTimer();
    state.i += 1;
    if (state.i >= state.queue.length) {
      state.phase = "done"; unhighlight();
      els.start.textContent = "Start calling"; els.start.className = "pdd-btn go";
      setState("Done", "");
      els.card.hidden = true; els.timeline.hidden = true; els.note.value = ""; els.err.textContent = ""; els.nextline.innerHTML = "";
      els.idle.hidden = false; els.idle.innerHTML = `<h3>All done</h3><p>${state.queue.length} records worked through.</p>`;
      renderActions("done"); updateCount();
      return;
    }
    const item = state.queue[state.i];
    els.note.value = ""; els.err.textContent = "";
    state.phase = "preview";
    updateCount(); highlight(item);
    if (item.row && item.row.scrollIntoView) item.row.scrollIntoView({ block: "center", behavior: "smooth" });
    els.body.scrollTop = 0;
    renderCard(item); renderNextLine();
    setState("Loading…", "");
    renderActions("preview");
    els.start.textContent = "Pause"; els.start.className = "pdd-btn warn";
    await enrich(item);
    if (state.queue[state.i] !== item || state.phase !== "preview") return;
    renderCard(item);
    startPreview();
    for (const n of state.queue.slice(state.i + 1, state.i + 3)) if (!n.enriched) { n.enriched = true; enrich(n).then(() => loadShot(n.website)); }
  }

  function startPreview() {
    stopTimer();
    state.phase = "preview"; renderActions("preview");
    els.start.textContent = "Pause"; els.start.className = "pdd-btn warn";
    if (!settings.autoDial) { setState("Ready · press Call", "live"); els.hint.innerHTML = "<kbd>↵</kbd> or Call now dials · <kbd>→</kbd> skips"; return; }
    const total = Number(settings.preview) || 0;
    state.countdown = total;
    if (total <= 0) { dial(); return; }
    const run = ++state.run;
    const call = els.actions.querySelector("[data-cd]");
    const tick = () => {
      if (run !== state.run || state.phase !== "preview") { stopTimer(); return; }
      setState(`Calling in ${state.countdown}s`, "live");
      if (call) { call.querySelector("span").innerHTML = `Call now · ${state.countdown}s <kbd>↵</kbd>`; call.querySelector("i").style.width = Math.round(100 * (total - state.countdown) / total) + "%"; }
      if (state.countdown <= 0) { stopTimer(); dial(); return; }
      state.countdown -= 1;
    };
    tick();
    state.timer = setInterval(tick, 1000);
  }

  function dial(redial) {
    stopTimer();
    const item = state.queue[state.i];
    if (!item || !item.phone) { next(); return; }
    state.phase = "calling";
    const number = settings.testNumber || item.phone;
    setState(settings.testNumber ? "Test call dialed" : "Dialed", settings.testNumber ? "test" : "live");
    renderActions("calling");
    els.start.textContent = "Pause"; els.start.className = "pdd-btn warn";
    const a = document.createElement("a");
    a.href = `${settings.scheme}:${number}`;
    a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    els.note.focus();
  }

  let saving = false;
  async function finish(outcome) {
    if (saving) return;
    saving = true;
    const item = state.queue[state.i];
    setState("Saving…", "");
    for (const b of els.actions.querySelectorAll("button")) b.disabled = true;
    try {
      const r = await logOutcome(item, outcome, els.note.value.trim());
      if (!r.ok) { els.err.textContent = "Not logged: " + r.error; renderActions("calling"); setState("Error", "test"); return; }
      next();
    } finally { saving = false; }
  }

  function openMeetingForm() {
    const item = state.queue[state.i];
    const d = new Date(); d.setDate(d.getDate() + 1); if (d.getDay() === 6) d.setDate(d.getDate() + 2); if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    const date = d.toISOString().slice(0, 10);
    els.actions.innerHTML = `
      <div class="pdd-form">
        <div class="pdd-form-title">Meeting booked with ${esc(item.org || item.title)}</div>
        <label>Date <input type="date" data-f="date" value="${date}"></label>
        <label>Time <input type="time" data-f="time" value="10:00" step="300"></label>
        <label>Length <select data-f="dur"><option value="00:30">30 min</option><option value="00:45">45 min</option><option value="01:00">60 min</option></select></label>
        <label>Held by <select data-f="owner"><option value="">${esc(settings.userName || "me")}</option></select></label>
        <div class="pdd-form-actions"><button class="pdd-btn go" data-f="save">Save meeting</button><button class="pdd-link" data-f="cancel">Back</button></div>
        <div class="pdd-form-what" data-f="what"></div>
      </div>`;
    const f = (k) => els.actions.querySelector(`[data-f="${k}"]`);
    f("what").textContent = item.kind === "lead"
      ? "Converts the lead to a deal (pipeline and stage from the settings), logs a First meeting booked activity (today, done) and adds the meeting to the calendar."
      : "Logs a First meeting booked activity on the deal (today, done), adds the meeting to the calendar and moves the deal to the First meeting booked stage.";
    api("/users").then((r) => { if (!r.ok) return; const sel = f("owner"); if (!sel) return; for (const u of r.data.filter((u) => u.active_flag).sort((a, b) => a.name.localeCompare(b.name))) { const o = document.createElement("option"); o.value = u.id; o.textContent = u.name; sel.appendChild(o); } });
    f("cancel").addEventListener("click", () => renderActions("calling"));
    f("save").addEventListener("click", () => bookMeeting(item, { date: f("date").value, time: f("time").value, dur: f("dur").value, owner: f("owner").value }));
    f("date").focus();
  }

  async function bookMeeting(item, m) {
    if (!m.date) { els.err.textContent = "Pick a date."; return; }
    if (saving) return;
    saving = true;
    const saveBtn = els.actions.querySelector('[data-f="save"]'); if (saveBtn) saveBtn.disabled = true;
    setState("Saving meeting…", "");
    els.err.textContent = "";
    try {
      let dealId = item.kind === "deal" ? Number(item.id) : null;
      if (item.kind === "lead") {
        if (!item.id) throw new Error("This row could not be matched to a lead, so it cannot be converted.");
        const c = await api(`/leads/${item.id}/convert/deal`, { method: "POST", body: await bookTarget(), v2: true });
        if (!c.ok) throw new Error("Convert failed: " + c.error);
        const cid = c.data && c.data.conversion_id;
        for (let n = 0; n < 15 && !dealId; n++) {
          await new Promise((r) => setTimeout(r, 1000));
          const st = await api(`/leads/${item.id}/convert/status/${cid}`, { v2: true });
          if (st.ok && st.data && st.data.status === "completed") dealId = st.data.deal_id;
          if (st.ok && st.data && st.data.status === "failed") throw new Error("Pipedrive could not convert the lead.");
        }
        if (!dealId) throw new Error("Conversion is taking too long. Check the lead in Pipedrive.");
        item.kind = "deal"; item.id = String(dealId);
      }
      if (!dealId && item.personId) {
        const d = await api("/deals", { method: "POST", body: { title: item.org || item.title, person_id: item.personId, org_id: item.orgId || undefined, ...(await bookTarget()), user_id: settings.userId || undefined } });
        if (!d.ok) throw new Error("Could not create a deal: " + d.error);
        dealId = d.data.id; item.kind = "deal"; item.id = String(dealId);
      }
      if (!dealId) throw new Error("No deal to attach the meeting to.");
      const today = new Date().toISOString().slice(0, 10);
      const note = els.note.value.trim();
      const name = item.org || item.title;
      const bookBody = { subject: `${name} - First meeting booked`, type: "first_meeting_booked", done: 1, due_date: today, deal_id: dealId, user_id: settings.userId || undefined, person_id: item.personId || undefined, org_id: item.orgId || undefined, note };
      let a1 = await api("/activities", { method: "POST", body: bookBody });
      if (!a1.ok && /type/i.test(a1.error || "")) { bookBody.type = "meeting"; a1 = await api("/activities", { method: "POST", body: bookBody }); }
      if (!a1.ok) throw new Error("Booking activity failed: " + a1.error);
      const a2 = await api("/activities", { method: "POST", body: { subject: `First meeting: ${name}`, type: "meeting", done: 0, due_date: m.date, due_time: m.time, duration: m.dur, deal_id: dealId, person_id: item.personId || undefined, org_id: item.orgId || undefined, user_id: m.owner ? Number(m.owner) : (settings.userId || undefined), note } });
      if (!a2.ok) els.err.textContent = "Booked, but the calendar meeting failed: " + a2.error;
      await loadStages();
      const deal = await api("/deals/" + dealId);
      if (deal.ok) {
        const stage = state.stages.find((s) => s.pipeline_id === deal.data.pipeline_id && /first meeting booked|meeting booked/i.test(s.name));
        if (stage && stage.id !== deal.data.stage_id) await api("/deals/" + dealId, { method: "PUT", body: { stage_id: stage.id } });
      }
      next();
    } catch (e) {
      els.err.textContent = "Not saved: " + (e.message || e);
      setState("Error", "test");
      renderActions("calling");
    } finally { saving = false; }
  }

  // ---------- mount on list pages, follow SPA navigation ----------
  function mount() {
    const onList = LIST_RE.test(location.pathname);
    if (onList && !panel) build();
    if (!onList && panel && state.phase === "idle") { panel.remove(); panel = null; }
  }
  // After the extension is reloaded, the old copy of this script loses its runtime. Stop quietly
  // instead of throwing "Extension context invalidated" every two seconds.
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  let lastHref = "";
  var ticker = setInterval(() => {
    try {
      if (dead) { clearInterval(ticker); return; }
      if (!alive()) { teardown(); return; }
      if (location.href !== lastHref) { lastHref = location.href; mount(); }
      if (panel && state.phase === "idle") renderIdle();
    } catch (e) { if (invalidated(e)) teardown(); else throw e; }
  }, 2000);
  try { mount(); } catch (e) { if (invalidated(e)) teardown(); else throw e; }
})();
