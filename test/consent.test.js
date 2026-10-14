import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { check, RULES } from '../src/index.js';

const fx = (n) => new URL(`./fixtures/${n}`, import.meta.url).pathname;
const rules = (r) => r.findings.map((f) => f.rule);
const site = (files) => { const d = mkdtempSync(join(tmpdir(), 'cw-')); for (const [p, c] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), c); } return d; };
const page = (h, b = '') => `<!doctype html><html><head><title>t</title>${h}</head><body>${b}</body></html>`;
const BANNER = '<div id="cookie-banner"><button class="btn">Accept all</button><button class="btn">Reject all</button></div><a href="#" class="cookie-settings">Cookie settings</a>';

test('good fixture is clean', () => { assert.deepEqual(check(fx('good')).findings, []); });
test('bad fixture reports every rule', () => { const r = rules(check(fx('bad'))); for (const k of Object.keys(RULES)) assert.ok(r.includes(k), k); });
test('no trackers, no banner needed', () => { assert.deepEqual(rules(check(site({ 'a.html': page('<script src="/app.js"></script>') }))), []); });
test('essential vendors (payments, captcha) do not need consent', () => {
  assert.deepEqual(rules(check(site({ 'a.html': page('<script src="https://js.stripe.com/v3/"></script><script src="https://www.google.com/recaptcha/api.js"></script>') }))), []);
});
test('CMP data attributes gate scripts; Cookiebot detected as CMP', () => {
  const d = site({ 'a.html': page('<script id="Cookiebot" src="https://consent.cookiebot.com/uc.js"></script><script data-cookieconsent="statistics" type="text/plain" src="https://static.hotjar.com/x.js"></script>', '<a href="javascript:Cookiebot.renew()">Change consent</a>') });
  assert.deepEqual(rules(check(d)), []);
});
test('Consent Mode with default denied allows Google tags to load', () => {
  const d = site({ 'a.html': page("<script>gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied'})</script><script src=\"https://www.googletagmanager.com/gtag/js?id=G\"></script>", BANNER) });
  assert.deepEqual(rules(check(d)), []);
});
test('options: allowEmbeds, essential, cmpProvidesWithdraw', () => {
  const d = site({ 'a.html': page('<link rel="stylesheet" href="https://fonts.googleapis.com/css?x">', '') });
  assert.deepEqual(rules(check(d)), ['consent-embed-ungated']);
  assert.deepEqual(rules(check(d, { allowEmbeds: true })), []);
  const e = site({ 'a.html': page('<script src="https://plausible.io/js/script.js"></script>') });
  assert.ok(rules(check(e)).includes('consent-tracker-ungated'));
  assert.deepEqual(rules(check(e, { essential: ['plausible'] })), []);
  const f = site({ 'a.html': page('<script src="https://cdn.cookielaw.org/x.js"></script><script type="text/plain" class="optanon-category-C0002" data-category="perf" src="https://static.hotjar.com/x.js"></script>') });
  assert.deepEqual(rules(check(f)), ['consent-withdraw-missing']);
  assert.deepEqual(rules(check(f, { cmpProvidesWithdraw: true })), []);
});
test('necessary checkbox may be checked', () => {
  assert.ok(!rules(check(site({ 'a.html': page('<script type="text/plain" data-category="x" src="https://static.hotjar.com/x.js"></script>', '<div class="cookie-banner"><input type="checkbox" name="necessary" checked><button>Accept</button><button>Reject</button></div><button>Cookie settings</button>') }))).includes('consent-prechecked'));
});
test('allowlist with expiry', () => {
  const d = site({ 'a.html': page('<link rel="stylesheet" href="https://fonts.googleapis.com/css?x">') });
  const r = check(d, { now: new Date('2026-10-14') }, { allowlist: [{ rule: 'consent-embed-ungated', match: 'Google Fonts', reason: 'self-hosting next release', expires: '2026-11-15' }] });
  assert.equal(r.findings.length, 0); assert.equal(r.suppressed.length, 1);
});
test('CLI exit codes and formats', () => {
  const bin = new URL('../bin/consent-warden.js', import.meta.url).pathname;
  const run = (...x) => spawnSync(process.execPath, [bin, ...x], { encoding: 'utf8' });
  assert.equal(run(fx('good'), '--fail-on', 'info').status, 0);
  assert.equal(run(fx('bad')).status, 1);
  assert.equal(run(fx('bad'), '--fail-on', 'none').status, 0);
  assert.equal(run('/nonexistent-dir-xyz').status, 2);
  const s = JSON.parse(run(fx('bad'), '--format', 'sarif', '--fail-on', 'none').stdout); assert.equal(s.version, '2.1.0');
  assert.match(run(fx('bad'), '--format', 'markdown', '--fail-on', 'none').stdout, /\| Severity \|/);
});
