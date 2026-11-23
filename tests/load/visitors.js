// Bshatfine - load test of the API, run LOCALLY only (never against Vercel/Render).
//
// Each virtual user (VU) behaves like one visitor reading the public site:
// news list -> an article -> upcoming events -> projects, with pauses in between.
//
// Every VU gets its own fake visitor IP (X-Bsh-Client-Ip) together with the proxy secret,
// exactly like the real website server sends them. So the per-visitor rate limits apply
// per VU, the way they would for real, different visitors.
//
// Run:  k6 run -e PROXY_SECRET=load-test-secret tests\load\visitors.js
// Optional: -e BASE=http://localhost:5246   -e MAX_VUS=250

import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:5246';
const SECRET = __ENV.PROXY_SECRET || '';
const MAX = parseInt(__ENV.MAX_VUS || '250', 10);

export const options = {
  scenarios: {
    visitors: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.round(MAX * 0.1) }, // warm up
        { duration: '2m', target: Math.round(MAX * 0.4) },
        { duration: '2m', target: MAX },                    // peak
        { duration: '1m', target: MAX },                    // hold the peak
        { duration: '30s', target: 0 },                     // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // The test FAILS if more than 1% of requests fail, or if 95% of them are not answered within 500 ms
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    'http_req_duration{name:news list}': ['p(95)<500'],
    'http_req_duration{name:article}': ['p(95)<500'],
    'http_req_duration{name:upcoming events}': ['p(95)<500'],
    'http_req_duration{name:projects}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

function headersFor(vu) {
  // A distinct, private-range "visitor IP" per VU: 10.x.y.1
  const ip = `10.${Math.floor(vu / 250) % 250}.${vu % 250}.1`;
  return {
    'X-Bsh-Proxy-Secret': SECRET,
    'X-Bsh-Client-Ip': ip,
    'Accept': 'application/json',
  };
}

// Runs once before the test: find a published article to read
export function setup() {
  if (!SECRET) {
    throw new Error('Set -e PROXY_SECRET=... (the same value as ReverseProxy:SharedSecret on the local API).');
  }
  const res = http.get(`${BASE}/api/news?lang=ar&pageSize=10`, { headers: headersFor(0) });
  if (res.status !== 200) {
    throw new Error(`Setup failed: GET /api/news returned ${res.status}. Is the API running with the secret?`);
  }
  const items = res.json('items') || [];
  return { slugs: items.map((n) => n.slug).filter(Boolean) };
}

export default function (data) {
  const headers = headersFor(__VU);
  const lang = __VU % 3 === 0 ? 'en' : 'ar'; // about 1 in 3 visitors read English

  group('visitor', () => {
    const news = http.get(`${BASE}/api/news?lang=${lang}`, { headers, tags: { name: 'news list' } });
    check(news, { 'news list 200': (r) => r.status === 200 });
    sleep(1 + Math.random() * 2);

    if (data.slugs.length > 0) {
      const slug = data.slugs[Math.floor(Math.random() * data.slugs.length)];
      const article = http.get(`${BASE}/api/news/${slug}?lang=${lang}`, { headers, tags: { name: 'article' } });
      check(article, { 'article 200': (r) => r.status === 200 });
      sleep(2 + Math.random() * 3);
    }

    const events = http.get(`${BASE}/api/events/upcoming?lang=${lang}&limit=3`, { headers, tags: { name: 'upcoming events' } });
    check(events, { 'upcoming events 200': (r) => r.status === 200 });
    sleep(1 + Math.random() * 2);

    const projects = http.get(`${BASE}/api/entries?kind=project&lang=${lang}`, { headers, tags: { name: 'projects' } });
    check(projects, { 'projects 200': (r) => r.status === 200 });
    sleep(1 + Math.random() * 2);
  });
}
