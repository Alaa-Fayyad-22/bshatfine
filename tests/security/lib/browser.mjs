// Browser checks with Playwright, using the locally installed Google Chrome
// (no browser download). Set SECTEST_CHROME to a chrome.exe path to override.
import { chromium } from "playwright-core";
import { config } from "./config.mjs";

let browser;

export async function getBrowser() {
  if (browser) return browser;
  const attempts = [];
  const options = process.env.SECTEST_CHROME
    ? [{ executablePath: process.env.SECTEST_CHROME }]
    : [{ channel: "chrome" }, { channel: "msedge" }, {}];
  for (const o of options) {
    try {
      browser = await chromium.launch({ headless: true, ...o });
      return browser;
    } catch (e) {
      attempts.push(String(e.message).split("\n")[0]);
    }
  }
  throw new Error(`No browser could be started: ${attempts.join(" | ")}`);
}

export async function closeBrowser() {
  await browser?.close();
  browser = undefined;
}

// Watches everything that would show script execution: dialogs, a wrapped
// alert/confirm/prompt counter, CSP violation events and page errors.
const INIT = `
  window.__xss = 0;
  window.__csp = [];
  for (const name of ["alert", "confirm", "prompt"]) {
    const original = window[name];
    window[name] = function () { window.__xss++; try { return original.apply(this, arguments); } catch (e) {} };
  }
  document.addEventListener("securitypolicyviolation", (e) => {
    window.__csp.push(e.violatedDirective + " " + (e.blockedURI || "") + " " + (e.sample || ""));
  });
`;

// A context with an optional session cookie ("bsh.session=...") for localhost.
export async function newContext(cookie) {
  const b = await getBrowser();
  const context = await b.newContext({ locale: "ar" });
  if (cookie) {
    const [name, ...rest] = cookie.split("=");
    const host = new URL(config.webUrl).hostname;
    await context.addCookies([
      { name, value: rest.join("="), domain: host, path: "/", httpOnly: true, secure: true, sameSite: "Strict" },
    ]);
  }
  await context.addInitScript(INIT);
  return context;
}

export function watch(page) {
  const seen = { dialogs: [], pageErrors: [], cspConsole: [], offsite: [] };
  page.on("dialog", async (d) => {
    seen.dialogs.push(`${d.type()}: ${d.message()}`);
    await d.dismiss().catch(() => {});
  });
  page.on("pageerror", (e) => seen.pageErrors.push(String(e.message).slice(0, 200)));
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) seen.cspConsole.push(m.text().slice(0, 300));
  });
  return seen;
}

// What the DOM shows: unsafe links, inline event handlers, injected scripts.
export async function domFindings(page) {
  return page.evaluate(() => {
    const unsafe = /^\s*(javascript|data|vbscript):/i;
    const links = [...document.querySelectorAll("a[href], area[href]")]
      .map((a) => a.getAttribute("href"))
      .filter((h) => unsafe.test(h));
    const srcs = [...document.querySelectorAll("iframe[src], embed[src], object[data], form[action], img[src]")]
      .map((e) => e.getAttribute("src") ?? e.getAttribute("data") ?? e.getAttribute("action"))
      .filter((h) => h && /^\s*(javascript|vbscript):/i.test(h));
    const handlers = [];
    for (const el of document.querySelectorAll("*"))
      for (const attr of el.attributes)
        if (/^on/i.test(attr.name)) handlers.push(`<${el.tagName.toLowerCase()} ${attr.name}="${attr.value.slice(0, 60)}">`);
    const scripts = [...document.scripts].map((s) => s.textContent ?? "").filter((s) => /alert\(1\)|__xssProbe/.test(s) && !/self\.__next_f/.test(s));
    // (Next.js streams its own inline <script> tags anywhere in the body, so
    // scripts are judged by their content above, not by where they are.)
    const injected = [...document.querySelectorAll("main iframe, main object, main embed, main base, main meta")].length;
    return {
      links,
      srcs,
      handlers,
      scripts: scripts.map((s) => s.slice(0, 120)),
      injected,
      xss: window.__xss,
      csp: window.__csp,
      // Visible text plus what form fields hold (editors show saved text there)
      text:
        (document.body?.innerText ?? "") +
        [...document.querySelectorAll("input, textarea")].map((e) => e.value).join("\n"),
    };
  });
}
