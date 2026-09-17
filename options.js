const $ = (id) => document.getElementById(id);
chrome.storage.local.get(["apiToken", "scheme", "preview", "setLabel", "testNumber", "autoDial", "userId", "userName", "thumKey", "bookStage", "dialDefault", "ringoverKey", "ringoverFrom", "ringoverDevice", "defaultCC"]).then((s) => {
  if (s.apiToken) $("apiToken").value = s.apiToken;
  $("scheme").value = s.scheme || "tel";
  $("preview").value = s.preview ?? 5;
  $("setLabel").checked = s.setLabel !== false;
  $("testNumber").value = s.testNumber || "";
  $("thumKey").value = s.thumKey || "";
  (s.dialDefault === "ringover" ? $("defRingover") : $("defPhone")).checked = true;
  $("ringoverKey").value = s.ringoverKey || "";
  $("ringoverDevice").value = s.ringoverDevice || "ALL";
  $("defaultCC").value = s.defaultCC || "";
  if (s.ringoverKey) loadRingoverNumbers(s.ringoverFrom);
  (s.autoDial === false ? $("dialManual") : $("dialAuto")).checked = true;
  if (s.apiToken) { identify(s.userId); loadStagePicker(s.bookStage); }
});

async function loadUsers(selected, me) {
  const sel = $("userId");
  const r = await chrome.runtime.sendMessage({ kind: "api", path: "/users" });
  sel.innerHTML = "";
  if (!r.ok) return;
  for (const u of r.data.filter((u) => u.active_flag).sort((a, b) => a.name.localeCompare(b.name))) {
    const o = document.createElement("option"); o.value = u.id; o.textContent = u.name + (me && u.id === me.id ? " (me)" : "");
    if (String(u.id) === String(selected || (me && me.id))) o.selected = true; sel.appendChild(o);
  }
}

async function loadStagePicker(selected) {
  const sel = $("bookStage");
  const [p, st] = await Promise.all([chrome.runtime.sendMessage({ kind: "api", path: "/pipelines" }), chrome.runtime.sendMessage({ kind: "api", path: "/stages" })]);
  if (!p.ok || !st.ok) { sel.innerHTML = '<option value="">could not load stages</option>'; return; }
  const names = Object.fromEntries(p.data.map((x) => [x.id, x.name]));
  sel.innerHTML = '<option value="">automatic (first stage named like "meeting booked")</option>';
  for (const s of st.data) { const o = document.createElement("option"); o.value = s.id; o.textContent = (names[s.pipeline_id] || s.pipeline_id) + " › " + s.name; if (String(s.id) === String(selected)) o.selected = true; sel.appendChild(o); }
}

async function loadRingoverNumbers(selected) {
  const sel = $("ringoverFrom");
  const r = await chrome.runtime.sendMessage({ kind: "ringover", path: "/users" });
  if (!r.ok) { sel.innerHTML = `<option value="">${r.error}</option>`; return; }
  const users = (r.data && (r.data.list || r.data)) || [];
  sel.innerHTML = '<option value="">the key owner\'s own number</option>';
  for (const u of Array.isArray(users) ? users : []) {
    const name = [u.firstname, u.lastname].filter(Boolean).join(" ") || u.email || "user";
    const nums = (u.numbers || u.number_list || []).map((n) => (typeof n === "object" ? (n.number || n.number_id || n.id) : n)).filter(Boolean);
    for (const n of nums) { const o = document.createElement("option"); o.value = String(n); o.textContent = `${name} · +${String(n).replace(/^\+/, "")}`; if (String(n) === String(selected)) o.selected = true; sel.appendChild(o); }
  }
  if (!sel.options[1]) sel.innerHTML += '<option value="" disabled>no numbers returned (Monitoring off?)</option>';
}

// Who owns the token decides who the calls are logged as. Admin tokens may pick someone else.
async function identify(selected) {
  const me = await chrome.runtime.sendMessage({ kind: "api", path: "/users/me" });
  const who = $("whoami");
  if (!me.ok) { who.textContent = "Token failed: " + me.error; who.className = "err"; $("adminRow").hidden = true; return null; }
  who.textContent = "This token belongs to " + me.data.name + ". Calls are logged as " + me.data.name + ".";
  who.className = "ok";
  if (me.data.is_admin) { $("adminRow").hidden = false; await loadUsers(selected, me.data); } else { $("adminRow").hidden = true; }
  return me.data;
}

$("save").addEventListener("click", async () => {
  const apiToken = $("apiToken").value.trim();
  await chrome.storage.local.set({ apiToken, scheme: $("scheme").value, preview: Math.max(0, Number($("preview").value) || 0), setLabel: $("setLabel").checked, testNumber: $("testNumber").value.trim(), autoDial: $("dialAuto").checked, thumKey: $("thumKey").value.trim(), bookStage: $("bookStage").value ? Number($("bookStage").value) : null,
    dialDefault: $("defRingover").checked ? "ringover" : "phone", ringoverKey: $("ringoverKey").value.trim(), ringoverFrom: $("ringoverFrom").value, ringoverDevice: $("ringoverDevice").value, defaultCC: $("defaultCC").value.replace(/\D/g, "") });
  if ($("ringoverKey").value.trim()) loadRingoverNumbers($("ringoverFrom").value);
  const st = $("status");
  st.textContent = "Checking token…"; st.className = "hint";
  const me = await identify($("userId").value);
  if (me && !$("bookStage").options[1]) await loadStagePicker($("bookStage").value);
  if (!me) { st.textContent = "Saved, but the token failed."; st.className = "err"; return; }
  let userId = me.id, userName = me.name;
  if (me.is_admin && $("userId").value) { userId = Number($("userId").value); userName = $("userId").selectedOptions[0].textContent.replace(/ \(me\)$/, ""); }
  await chrome.storage.local.set({ userId, userName });
  st.textContent = "Saved. Calls are logged as " + userName + "."; st.className = "ok";
});
