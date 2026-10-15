# consent-warden

[![npm version](https://img.shields.io/npm/v/consent-warden.svg)](https://www.npmjs.com/package/consent-warden) [![CI](https://github.com/MrLouisWright/consent-warden/actions/workflows/ci.yml/badge.svg)](https://github.com/MrLouisWright/consent-warden/actions/workflows/ci.yml) [![Node](https://img.shields.io/node/v/consent-warden.svg)](https://nodejs.org) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Check that your cookie banner actually behaves: nothing non-essential loads before opt-in, Reject is as easy as Accept, and consent can be withdrawn.

Most cookie-banner enforcement (ICO, CNIL, noyb complaints) is about behaviour, not cookie flags: the Meta pixel fires before anyone clicks, Consent Mode defaults to granted, Reject is a grey link hidden behind Settings, boxes are pre-ticked, and once dismissed there is no way back. `consent-warden` reads the built HTML and checks how trackers are loaded relative to the banner and how the banner itself is built, reporting each problem with the file, line, severity and a **concrete fix**.

CLI, library and GitHub Action. Node.js 18+, **zero runtime dependencies**. Works on any static build output (Astro, Next.js `output: 'export'`, Eleventy, Hugo, Jekyll, Docusaurus, VitePress, plain HTML) and runs offline: point it at the folder your build writes. By Louis Wright.

## Features

- **Loading before opt-in:** tracking scripts, inline SDK snippets and pixels must be blocked until consent: `type="text/plain"` with a category (`data-category`, `data-cookieconsent`, `data-cookiecategory`, ...), a consent check in the snippet, or Google Consent Mode with defaults denied.
- **Consent Mode:** `gtag("consent","default",…)` granting `ad_storage`/`analytics_storage` up front, or Google tags with no default at all.
- **Embeds:** YouTube, Vimeo, Google Maps, Google Fonts and social/chat widgets that load before consent (use click-to-load or self-host).
- **Banner presence:** pages that load trackers with no banner and no CMP (Cookiebot, OneTrust, Usercentrics, Klaro, CookieConsent, Complianz, iubenda, Osano, Termly, CookieYes are recognised).
- **Equal choice:** Accept without Reject on the first layer, Reject as a link or with weaker styling than Accept, pre-ticked non-essential checkboxes, implied-consent wording ("by continuing to browse…").
- **Withdrawal:** a persistent "Cookie settings" link or button outside the banner.
- Payments, captcha, CDNs and CMPs count as strictly necessary; add your own with `--essential`.
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides, GitHub Action with job summary.

### Scope

consent-warden checks consent behaviour as expressed in the built HTML. It does not inspect cookie attributes (cookie-sentinel), inventory vendors (tracker-warden) or check Global Privacy Control (gpc-warden). Banners injected entirely at runtime by a CMP script are recognised by the CMP, but their buttons cannot be inspected statically.

## Rules

| Rule | Default severity | What it means |
|---|---|---|
| `consent-banner-missing` | high | Non-essential trackers load but no consent banner / CMP was found |
| `consent-tracker-ungated` | high | Tracking script or pixel loads before opt-in (not blocked by type="text/plain", a CMP data attribute or Consent Mode) |
| `consent-mode-default-granted` | high | Google Consent Mode default grants ad_storage/analytics_storage before the visitor chooses |
| `consent-reject-missing` | high | Banner offers Accept but no equally available Reject on the first layer |
| `consent-prechecked` | high | Non-essential consent categories are pre-ticked |
| `consent-implied` | medium | Banner relies on implied consent ("by continuing to browse you agree") |
| `consent-reject-unequal` | medium | Reject is less prominent than Accept (link vs button, or styled differently) |
| `consent-embed-ungated` | medium | Third-party embed (video, maps, fonts, social) loads before consent |
| `consent-mode-missing` | medium | Google tags are used without a Consent Mode default |
| `consent-withdraw-missing` | medium | No way to change or withdraw consent later (cookie settings link) on the page |
| `allowlist-expired` | medium | An allowlist entry is past its `expires` date |
| `allowlist-unused` | info | An allowlist entry matched nothing |

## Install and run

```bash
npx consent-warden dist
npx consent-warden dist --fail-on medium
npx consent-warden public --essential plausible --allow-embeds
npx consent-warden out --cmp-provides-withdraw --format sarif > consent.sarif
```

Pages are mapped to URLs the way static hosts serve them: `index.html` → `/`, `blog/index.html` → `/blog/`, `about.html` → `/about.html` (or `/about` with `--clean-urls`). Pass `--base-url` with your public URL, or let it be inferred from canonical / `og:url` tags. Meta-refresh redirect stubs and `404.html` are skipped. `X-Robots-Tag` and `Link` headers are read from Netlify/Cloudflare `_headers` and `vercel.json`.

### Sample output

```text
consent-warden — https://acme.example
3 page(s); 3 load trackers

HIGH     index.html:2 gtag('consent','default') grants storage before consent on / [consent-mode-default-granted]
         ↳ fix: Set ad_storage, ad_user_data, ad_personalization and analytics_storage to 'denied' by default and update them on opt-in.
HIGH     index.html:3 Meta Pixel (script) loads on / before consent [consent-tracker-ungated]
         ↳ fix: Block it until opt-in: <script type="text/plain" data-category="analytics"> (or your CMP's equivalent), or use Consent Mode with default denied.
HIGH     index.html:3 Hotjar (script) loads on / before consent [consent-tracker-ungated]
         ↳ fix: Block it until opt-in: <script type="text/plain" data-category="analytics"> (or your CMP's equivalent), or use Consent Mode with default denied.
HIGH     index.html:6 Consent checkbox "marketing" is pre-ticked [consent-prechecked]
```

## Options

```text
consent-warden 1.0.0 — check cookie-banner consent behaviour in your built site

Usage: consent-warden [site-dir] [options]

Site
      --base-url <url>        Public URL of the site, e.g. https://example.com (default: inferred from canonical/og:url)
      --include <globs>       Only check these pages (file or URL path globs, comma-separated)
      --exclude <globs>       Skip these pages
      --clean-urls            Pages are served without .html (about.html -> /about)
Consent
      --essential <vendors>    Vendor ids treated as strictly necessary (payments, security and CMPs are by default)
      --allow-embeds           Do not report video/maps/fonts/social embeds that load before consent
      --cmp-provides-withdraw  Your CMP injects its own floating settings button

Common
  -c, --config <file>     JSON config (default: .consent-warden.json or "consentWarden" in package.json)
  -f, --format <fmt>      text (default) | json | sarif | markdown
      --json <file>       Also write a JSON report
      --sarif <file>      Also write SARIF 2.1.0
      --markdown <file>   Also write Markdown (e.g. for a job summary)
      --fail-on <sev>     critical | high | medium | low | info | none (default: high)
      --list-rules        Print rules and default severities
      --no-fixes          Hide fix suggestions in text output
      --no-color          Disable colours
  -v, --version / -h, --help

Exit codes: 0 = passed, 1 = findings at or above --fail-on, 2 = usage, config or read error.
```

## Configuration and allowlist

Options can live in `.consent-warden.json` (or a `"consentWarden"` key in `package.json`, or `--config <file>`):

```json
{
  "failOn": "medium",
  "severity": {
    "consent-banner-missing": "low"
  },
  "allowlist": [
    {
      "rule": "consent-embed-ungated",
      "subject": "/contact.html#google-maps",
      "reason": "Map embed approved by DPO, click-to-load in next release",
      "expires": "2027-03-31"
    }
  ],
  "essential": [
    "plausible"
  ],
  "allowEmbeds": false,
  "cmpProvidesWithdraw": false
}
```

- **`severity`** changes a rule's severity, or turns it `"off"`.
- **`allowlist`** entries suppress matching findings. Each needs a `reason` and matches on any combination of `rule`, `file`, `subject` (globs with `*`) and `match` (a substring of the message). Add `expires` (`YYYY-MM-DD`) so the exception is time-boxed: once it lapses the finding comes back along with an `allowlist-expired` finding (medium). Entries that no longer match anything are reported as `allowlist-unused` (info).

Config can also set `baseUrl`, `include`, `exclude` and `cleanUrls`. The config file is looked up in the site directory first, then in the current directory, so `.consent-warden.json` can live at your repository root. Other keys: `essential` (vendor ids), `allowEmbeds` and `cmpProvidesWithdraw`.

## Output and exit codes

- `--format text` (default), `json`, `sarif` (SARIF 2.1.0 for GitHub code scanning) or `markdown` (for job summaries and PR comments). `--json`, `--sarif` and `--markdown` write extra report files in the same run.
- `--fail-on <severity>` sets the threshold (`critical`, `high`, `medium`, `low`, `info`, `none`; default `high`).
- Exit codes: **0** passed, **1** findings at or above `--fail-on`, **2** usage, config or read error.

## GitHub Action

```yaml
permissions:
  contents: read
  security-events: write   # only needed for the SARIF upload
jobs:
  consent-warden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with: { persist-credentials: false }
      - run: npm ci && npm run build   # produce the static site first
      - uses: MrLouisWright/consent-warden@v1
        with:
          path: dist
          fail-on: high
          sarif: consent-warden.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: consent-warden.sarif }
```

| Input | Description | Default |
|---|---|---|
| `path` | Built site directory (e.g. dist, public, _site) | `.` |
| `base-url` | Public URL of the site, e.g. https://example.com | |
| `fail-on` | Failure threshold | `high` |
| `config` | Config file path | |
| `sarif` / `json` | Write SARIF / JSON report to this path | |
| `job-summary` | Add the Markdown report to the job summary | `true` |
| `args` | Extra CLI arguments | |

The action runs the bundled CLI with Node 20; it has no dependencies to install. Pin it to a commit SHA if your policy requires it.

## Library

```js
import { check } from "consent-warden";
const report = check("dist", { essential: ["plausible"] });
console.log(report.counts);
```

Types are included.

## Requirements

Node.js 18 or newer. Zero runtime dependencies.

## Support

If this project is useful to you, you can support its development with a donation: [Buy me a coffee](https://donate.stripe.com/aFa00lek3cvX4Ds2Fk9EI0b). It helps keep these tools maintained, documented and free for everyone.

## Credit (optional)

Free to use under MIT, no attribution required. If consent-warden helps you, a link back is appreciated:

```html
<a href="https://louiswright.co.uk">Built with consent-warden by Louis Wright</a>
```

```markdown
[![Built with consent-warden by Louis Wright](https://img.shields.io/badge/built%20with-consent--warden-blue)](https://louiswright.co.uk)
```

## Licence

MIT © Louis Wright ([Louis Wright](https://github.com/MrLouisWright))
