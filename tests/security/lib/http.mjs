// HTTP helpers. Every response is recorded (without cookies or passwords) so
// group 7 can check that no error body anywhere in the run leaks internals.
import http from "node:http";
import { config } from "./config.mjs";

export const responseLog = [];

const SECRET_FIELDS = /^(password|currentPassword|newPassword|temporaryPassword|code)$/i;

// A distinct client address per request (the API trusts X-Forwarded-For from
// loopback, as ASP.NET does by default), so its per-IP limiters only count
// what a test means them to count. Rate-limit tests pass their own value.
let ipCounter = Math.floor(Math.random() * 60000) * 256;
export function freshIp() {
  ipCounter = (ipCounter + 1) % 16777216;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

export function redact(value) {
  if (value === undefined || value === null) return value;
  if (typeof value === "string") {
    try {
      return JSON.stringify(redact(JSON.parse(value)));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = SECRET_FIELDS.test(k) ? "***" : redact(v);
    return out;
  }
  return value;
}

export function short(text, max = 400) {
  if (text === undefined || text === null) return "";
  const s = String(text);
  return s.length > max ? `${s.slice(0, max)}… (${s.length} chars)` : s;
}

function tryJson(text) {
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One request. Options:
 *  json      body sent as JSON (object or a raw string)
 *  form      a FormData body (multipart)
 *  body      any other body (string/Buffer), with headers set by the caller
 *  cookie    "bsh.session=..." (or any Cookie header value)
 *  headers   extra headers
 *  xff       X-Forwarded-For value; default: a fresh address for API calls,
 *            none for website calls; false = never send one
 *  retry429  wait for Retry-After and try again (default true, up to 4 times)
 */
export async function request(base, method, path, opts = {}) {
  const url = base + path;
  const headers = { ...(opts.headers ?? {}) };
  if (opts.cookie) headers.cookie = opts.cookie;
  const isApi = base === config.apiUrl;
  if (opts.xff !== false && !("x-forwarded-for" in headers)) {
    if (opts.xff) headers["x-forwarded-for"] = opts.xff;
    else if (isApi) headers["x-forwarded-for"] = freshIp();
  }
  let body = opts.body;
  if (opts.json !== undefined) {
    body = typeof opts.json === "string" ? opts.json : JSON.stringify(opts.json);
    if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type"))
      headers["content-type"] = "application/json";
  }
  if (opts.form) body = opts.form;

  const shown = {
    method,
    url,
    body: opts.form ? "(multipart form)" : short(redact(opts.json ?? (typeof body === "string" ? body : undefined)), 300),
  };

  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(opts.timeout ?? 60000),
      });
    } catch (e) {
      const out = {
        ...shown,
        status: 0,
        error: String(e?.cause?.code ?? e?.name ?? e),
        ms: performance.now() - started,
        headers: new Headers(),
        text: "",
        setCookie: [],
      };
      responseLog.push(out);
      return out;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ms = performance.now() - started;
    const ct = res.headers.get("content-type") ?? "";
    const isText = !/^(image|application\/octet-stream|font)/.test(ct);
    const text = isText ? buf.toString("utf8") : "";
    const out = {
      ...shown,
      status: res.status,
      ms,
      headers: res.headers,
      text,
      bytes: buf,
      json: isText ? tryJson(text) : undefined,
      setCookie: res.headers.getSetCookie?.() ?? [],
    };
    // Only the rate LIMITER's answer is retried (its wait is at most a minute),
    // never an account lockout ("Too many failed attempts", 15 minutes).
    const wait = Number(res.headers.get("retry-after") ?? "10");
    if (
      res.status === 429 &&
      opts.retry429 !== false &&
      attempt < 4 &&
      text.includes("Too many requests") &&
      Number.isFinite(wait) &&
      wait <= 70
    ) {
      await sleep(wait * 1000 + 250);
      continue;
    }
    responseLog.push({ method, url, status: out.status, text: short(text, 4000), ct });
    return out;
  }
}

export const api = (method, path, opts) => request(config.apiUrl, method, path, opts);
export const web = (method, path, opts) => request(config.webUrl, method, path, opts);

// A request whose path is sent exactly as written (no URL normalisation), for
// "../" and encoded-dot checks that fetch() would resolve before sending.
export function rawRequest(base, method, rawPath, headers = {}) {
  const u = new URL(base);
  return new Promise((resolve) => {
    const started = performance.now();
    const req = http.request(
      { host: u.hostname, port: u.port, method, path: rawPath, headers: { "x-forwarded-for": freshIp(), ...headers } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const ct = res.headers["content-type"] ?? "";
          const text = /^image/.test(ct) ? "" : buf.toString("utf8");
          const out = { method, url: base + rawPath, status: res.statusCode, headers: res.headers, text, bytes: buf, ms: performance.now() - started };
          responseLog.push({ method, url: out.url, status: out.status, text: short(text, 4000), ct });
          resolve(out);
        });
      },
    );
    req.on("error", (e) => resolve({ method, url: base + rawPath, status: 0, error: String(e.code ?? e), text: "", headers: {} }));
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

// "bsh.session=<value>" from a response's Set-Cookie headers, or null.
export function sessionCookie(res) {
  for (const c of res.setCookie ?? []) {
    const m = /^bsh\.session=([^;]*)/.exec(c);
    if (m && m[1]) return `bsh.session=${m[1]}`;
  }
  return null;
}

// What a failure report shows about a request and its answer.
export function evidence(res, expected) {
  return {
    request: `${res.method} ${res.url}${res.body ? `\n  body: ${res.body}` : ""}`,
    response: `${res.status}${res.error ? ` (${res.error})` : ""} ${short(res.text, 600)}`,
    expected,
  };
}
