// Proxies Pipedrive API calls for the content script so the token never touches the page
// and CORS is handled by the extension's host permissions.

const API = "https://api.pipedrive.com/v1";
const API2 = "https://api.pipedrive.com/api/v2";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.kind === "api") {
    apiCall(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async
  }
  if (msg && msg.kind === "ringover") {
    ringoverCall(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg && msg.kind === "image") {
    fetchImage(msg.url).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg && msg.kind === "openOptions") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

async function apiCall({ method = "GET", path, params = {}, body, v2 = false }) {
  const { apiToken } = await chrome.storage.local.get("apiToken");
  if (!apiToken) return { ok: false, error: "No API token. Open the extension settings." };
  const url = new URL((v2 ? API2 : API) + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, v);
  url.searchParams.set("api_token", apiToken);
  const init = { method, headers: { "Content-Type": "application/json" } };
  if (body || method === "POST" || method === "PATCH") init.body = JSON.stringify(body || {});
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) return { ok: false, error: (j.error || r.statusText) + (j.error_info ? " " + j.error_info : ""), status: r.status };
  return { ok: true, data: j.data, additional: j.additional_data };
}

// Screenshots come from thum.io. Fetching them here (extension origin) and handing the page a
// data URL keeps the image outside the page's own content-security rules.
async function fetchImage(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return { ok: false, error: "HTTP " + r.status };
  const type = r.headers.get("content-type") || "";
  const buf = await r.arrayBuffer();
  let bin = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { ok: true, type, dataUrl: `data:${type};base64,${btoa(bin)}` };
}

// Ringover public API v2. The team key is entered in the settings; header is "Authorization: <key>".
async function ringoverCall({ method = "GET", path, body }) {
  const { ringoverKey, ringoverRegion } = await chrome.storage.local.get(["ringoverKey", "ringoverRegion"]);
  if (!ringoverKey) return { ok: false, error: "No Ringover API key in the settings." };
  const base = ringoverRegion === "us" ? "https://public-api-us.ringover.com/v2" : "https://public-api.ringover.com/v2";
  const init = { method, headers: { Authorization: ringoverKey, "Content-Type": "application/json" } };
  if (body) init.body = JSON.stringify(body);
  const r = await fetch(base + path, init);
  const text = await r.text();
  let j = {}; try { j = JSON.parse(text); } catch (e) {}
  if (!r.ok) return { ok: false, error: `Ringover ${r.status}: ${(j && (j.message || j.error)) || text.slice(0, 200) || r.statusText}` };
  return { ok: true, data: j };
}
