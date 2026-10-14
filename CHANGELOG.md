# Changelog

## 1.0.0 (2026-10-14)

First release, by Louis Wright.

- Trackers, pixels and embeds loading before opt-in; gating via `type="text/plain"` + CMP attributes or Consent Mode.
- Consent Mode default granted / missing.
- Banner presence (CMP detection), Accept without Reject, unequal Reject, pre-ticked boxes, implied consent.
- Persistent withdrawal ("Cookie settings") link.
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides.
- Composite GitHub Action with job summary.
