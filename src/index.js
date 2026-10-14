// consent-warden: static checks of cookie-banner consent behaviour in a built site. Louis Wright, MIT.
import { runBeacon, finder, SITE_OPTIONS, SITE_HELP, siteOptions, textOf, ancestor } from './site.js';
import { buildReport, UsageError } from './core.js';
import { VENDORS, TRACKING, thirdPartyResources } from './vendors.js';

export * from './core.js';
export { SITE_OPTIONS, SITE_HELP, siteOptions };

export const RULES = {
  'consent-banner-missing': { severity: 'high', title: 'Non-essential trackers load but no consent banner / CMP was found' },
  'consent-tracker-ungated': { severity: 'high', title: 'Tracking script or pixel loads before opt-in (not blocked by type="text/plain", a CMP data attribute or Consent Mode)' },
  'consent-mode-default-granted': { severity: 'high', title: 'Google Consent Mode default grants ad_storage/analytics_storage before the visitor chooses' },
  'consent-reject-missing': { severity: 'high', title: 'Banner offers Accept but no equally available Reject on the first layer' },
  'consent-prechecked': { severity: 'high', title: 'Non-essential consent categories are pre-ticked' },
  'consent-implied': { severity: 'medium', title: 'Banner relies on implied consent ("by continuing to browse you agree")' },
  'consent-reject-unequal': { severity: 'medium', title: 'Reject is less prominent than Accept (link vs button, or styled differently)' },
  'consent-embed-ungated': { severity: 'medium', title: 'Third-party embed (video, maps, fonts, social) loads before consent' },
  'consent-mode-missing': { severity: 'medium', title: 'Google tags are used without a Consent Mode default' },
  'consent-withdraw-missing': { severity: 'medium', title: 'No way to change or withdraw consent later (cookie settings link) on the page' },
};

const GATED_ATTRS = ['data-cookieconsent', 'data-cookiecategory', 'data-category', 'data-consent', 'data-cookie-consent', 'data-usercentrics', 'data-cmp-src', 'data-src', 'data-cookieyes', 'data-ot-ignore', 'data-type'];
const BANNER_RE = /\b(cookie[-_ ]?(banner|consent|notice|bar|popup|modal|law)|consent[-_ ]?(banner|manager|modal|bar|dialog)|cmp[-_ ]?(banner|container)|gdpr[-_ ]?(banner|consent|cookie)|cc[-_]banner|cookieconsent|onetrust-banner|CybotCookiebot)/i;
const ACCEPT_RE = /^(accept|accept all|allow all|allow|agree|i agree|ok|okay|got it|accept cookies|allow cookies|yes|alle akzeptieren|akzeptieren|tout accepter|accepter|aceptar|accetta)$/i;
const REJECT_RE = /^(reject|reject all|decline|deny|refuse|disagree|no thanks|necessary only|only necessary|essential only|use necessary cookies only|reject cookies|decline all|ablehnen|alle ablehnen|tout refuser|refuser|rechazar|rifiuta)$/i;
const SETTINGS_RE = /(cookie|consent|privacy)\s*(settings|preferences|choices|options)|manage (cookies|consent)|change (cookie|consent)|withdraw consent|cookie-einstellungen|paramètres des cookies/i;
const IMPLIED_RE = /by (continuing|using|browsing|staying)|if you continue|continued use|we assume you|you consent to (our|the) use of cookies by/i;
const isGated = (el) => (el.tag === 'script' && el.attrs.type && !/^(text\/javascript|module|application\/javascript)$/i.test(el.attrs.type.trim()) && !/json/i.test(el.attrs.type)) || GATED_ATTRS.some((a) => a in el.attrs && (a !== 'data-src' || !el.attrs.src)) || (el.tag === 'iframe' && !el.attrs.src && el.attrs['data-src']);

export function analyze(site, opts = {}, config = {}) {
  const { findings, add } = finder(RULES);
  const siteHost = site.origin ? new URL(site.origin).host : null;
  const essentialIds = new Set([...VENDORS.filter((v) => v.essential).map((v) => v.id), ...(config.essential || []), ...(opts.essential || [])]);
  let pagesWithTrackers = 0;
  for (const pg of site.pages) {
    const doc = pg.doc; const at = (e) => ({ file: pg.file, line: e?.line });
    const res = thirdPartyResources(doc, siteHost).filter((r) => !(r.vendor && essentialIds.has(r.vendor.id)) && !(r.kind === 'hint'));
    const scriptsText = doc.all.filter((e) => e.tag === 'script' && e.rawText).map((e) => e.rawText).join('\n');
    const cmp = res.some((r) => r.vendor?.category === 'consent') || thirdPartyResources(doc, siteHost).some((r) => r.vendor?.category === 'consent') || /Cookiebot|OneTrust|UC_UI|klaro|cookieconsent|CookieConsent|tarteaucitron|iubenda|osano|termly|cookieyes|complianz/i.test(scriptsText + doc.all.filter((e) => e.tag === 'script' && e.attrs.src).map((e) => e.attrs.src).join(' '));
    const bannerEls = doc.all.filter((e) => BANNER_RE.test(`${e.attrs.id || ''} ${e.attrs.class || ''} ${e.attrs['aria-label'] || ''} ${e.attrs['data-testid'] || ''}`) || (e.attrs.role === 'dialog' && /cookie|consent/i.test(textOf(e))));
    const banner = bannerEls[0];
    const tracking = res.filter((r) => r.vendor ? TRACKING.has(r.vendor.category) : r.kind === 'script' || r.kind === 'pixel');
    if (tracking.length) pagesWithTrackers++;
    // Consent Mode
    const cm = /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]\s*,\s*\{([^}]*)\}/.exec(scriptsText);
    const googleTags = res.some((r) => /^google-(analytics|tag-manager|ads)$/.test(r.vendor?.id || ''));
    let cmDenied = false;
    if (cm) { const granted = /(ad_storage|analytics_storage|ad_user_data|ad_personalization)['"]?\s*:\s*['"]granted['"]/.test(cm[1]); cmDenied = !granted && /denied/.test(cm[1]); if (granted) add('consent-mode-default-granted', `${pg.path}#consent-mode`, `gtag('consent','default') grants storage before consent on ${pg.path}`, "Set ad_storage, ad_user_data, ad_personalization and analytics_storage to 'denied' by default and update them on opt-in.", at(doc.all.find((e) => e.tag === 'script' && e.rawText?.includes(cm[0])))); }
    else if (googleTags && !cmp) add('consent-mode-missing', `${pg.path}#consent-mode`, `Google tags on ${pg.path} without a Consent Mode default`, "Add gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'}) before the tags load.", at(res.find((r) => /^google-/.test(r.vendor?.id || ''))?.el));
    // Ungated loading
    for (const r of res) {
      if (r.inline) { const code = r.el.rawText || ''; if (isGated(r.el)) continue; if (/^google-/.test(r.vendor.id) && cmDenied) continue; if (/consent|Cookiebot\.consent|OnetrustActiveGroups|hasConsent|consentGiven/i.test(code)) continue; }
      else if (isGated(r.el) || ancestor(r.el, (n) => n.tag === 'template' || isGated(n))) continue;
      if (r.vendor && /^google-/.test(r.vendor.id) && cmDenied) continue;
      const tracker = r.vendor ? TRACKING.has(r.vendor.category) : (r.kind === 'script' || r.kind === 'pixel');
      const name = r.vendor?.name || r.host;
      if (tracker) add('consent-tracker-ungated', `${pg.path}#${r.vendor?.id || r.host}`, `${name} (${r.kind}) loads on ${pg.path} before consent`, 'Block it until opt-in: <script type="text/plain" data-category="analytics"> (or your CMP\'s equivalent), or use Consent Mode with default denied.', at(r.el));
      else if (['iframe', 'stylesheet', 'media'].includes(r.kind) && r.vendor && ['video', 'maps', 'fonts', 'social', 'chat'].includes(r.vendor.category) && !(config.allowEmbeds ?? opts.allowEmbeds)) add('consent-embed-ungated', `${pg.path}#${r.vendor.id}`, `${name} ${r.kind} loads on ${pg.path} before consent`, r.vendor.category === 'fonts' ? 'Self-host the font files.' : 'Use a click-to-load placeholder (or youtube-nocookie.com) until consent.', at(r.el));
    }
    // Banner behaviour
    const needsBanner = tracking.length > 0 || res.some((r) => r.vendor && ['video', 'maps', 'social', 'chat'].includes(r.vendor.category));
    if (needsBanner && !cmp && !banner) add('consent-banner-missing', `${pg.path}#banner`, `${pg.path} loads ${[...new Set(tracking.map((r) => r.vendor?.name || r.host))].slice(0, 4).join(', ') || 'third-party embeds'} but has no consent banner`, 'Add a consent banner (or CMP) that blocks non-essential trackers until opt-in.', { file: pg.file });
    if (banner) {
      const inside = doc.all.filter((e) => ancestor(e, (n) => n === banner));
      const controls = inside.filter((e) => e.tag === 'button' || (e.tag === 'a' && e.attrs.href != null) || (e.tag === 'input' && /button|submit/i.test(e.attrs.type || '')) || e.attrs.role === 'button');
      const label = (e) => (textOf(e) || e.attrs.value || e.attrs['aria-label'] || '').trim();
      const accept = controls.find((e) => ACCEPT_RE.test(label(e))); const reject = controls.find((e) => REJECT_RE.test(label(e)));
      if (accept && !reject) add('consent-reject-missing', `${pg.path}#reject`, `Banner on ${pg.path} has "${label(accept)}" but no Reject on the first layer`, 'Add a "Reject all" button next to "Accept all" with the same prominence.', at(accept));
      else if (accept && reject) { const kind = (e) => (e.tag === 'a' ? 'link' : 'button'); const cls = (e) => String(e.attrs.class || '').split(/\s+/).filter((c) => /primary|secondary|link|outline|ghost|small|muted|text|btn--?(primary|secondary)/i.test(c)).sort().join(' '); if (kind(accept) !== kind(reject) || cls(accept) !== cls(reject)) add('consent-reject-unequal', `${pg.path}#reject`, `"${label(reject)}" is ${kind(reject)}${cls(reject) ? ` (${cls(reject)})` : ''} while "${label(accept)}" is ${kind(accept)}${cls(accept) ? ` (${cls(accept)})` : ''}`, 'Give Reject the same element type and styling as Accept.', at(reject)); }
      for (const cb of inside.filter((e) => e.tag === 'input' && /checkbox/i.test(e.attrs.type || '') && e.attrs.checked != null && e.attrs.disabled == null)) { const ctx = `${cb.attrs.name || ''} ${cb.attrs.id || ''} ${cb.attrs.value || ''}`; if (!/necessary|essential|required|strictly|functional/i.test(ctx)) add('consent-prechecked', `${pg.path}#${cb.attrs.name || cb.attrs.id || 'checkbox'}`, `Consent checkbox "${cb.attrs.name || cb.attrs.id}" is pre-ticked`, 'Leave non-essential categories unticked until the visitor opts in.', at(cb)); }
      if (IMPLIED_RE.test(textOf(banner))) add('consent-implied', `${pg.path}#implied`, `Banner text on ${pg.path} implies consent by continuing`, 'Ask for an explicit choice; continued browsing is not consent under GDPR/PECR.', at(banner));
    }
    if (needsBanner && (cmp || banner) && !(opts.cmpProvidesWithdraw ?? config.cmpProvidesWithdraw ?? false)) {
      const has = doc.all.some((e) => (e.tag === 'a' || e.tag === 'button') && (SETTINGS_RE.test(textOf(e) + ' ' + (e.attrs['aria-label'] || '')) || /cookie-?settings|consent-?settings|renew|showDetails|Cookiebot\.renew|OneTrust\.ToggleInfoDisplay|optanon-show-settings|ot-sdk-show-settings/i.test(`${e.attrs.onclick || ''} ${e.attrs.class || ''} ${e.attrs.id || ''} ${e.attrs.href || ''}`)) && !ancestor(e, (n) => n === banner));
      if (!has) add('consent-withdraw-missing', `${pg.path}#withdraw`, `${pg.path} has no "Cookie settings" link to change or withdraw consent`, 'Add a persistent "Cookie settings" link (e.g. in the footer) that reopens the banner.', { file: pg.file });
    }
  }
  return { findings, info: { pagesWithTrackers }, summary: `${site.pages.length} page(s); ${pagesWithTrackers} load trackers` };
}

export function check(dir, opts = {}, config = {}, configFile) {
  const tool = { name: 'consent-warden', version: opts.toolVersion || '1.0.0', rules: RULES, emoji: '🍪', defaultFile: 'index.html' };
  return runBeacon(tool, dir, { ...opts, UsageError }, config, configFile, analyze, buildReport);
}
