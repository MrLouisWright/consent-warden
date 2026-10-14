#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { mainCli, check, RULES, SITE_OPTIONS, SITE_HELP, splitList } from '../src/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
mainCli({
  name: 'consent-warden', version: pkg.version, configKey: 'consentWarden', rules: RULES,
  tagline: 'check cookie-banner consent behaviour in your built site',
  usage: 'Usage: consent-warden [site-dir] [options]',
  help: `${SITE_HELP}Consent
      --essential <vendors>    Vendor ids treated as strictly necessary (payments, security and CMPs are by default)
      --allow-embeds           Do not report video/maps/fonts/social embeds that load before consent
      --cmp-provides-withdraw  Your CMP injects its own floating settings button
`,
  options: { ...SITE_OPTIONS, essential: { type: 'string', multiple: true }, 'allow-embeds': { type: 'boolean' }, 'cmp-provides-withdraw': { type: 'boolean' } },
  run: async ({ dir, values: o, config, configFile }) => check(dir, { cli: o, essential: splitList(o.essential), allowEmbeds: o['allow-embeds'] || undefined, cmpProvidesWithdraw: o['cmp-provides-withdraw'] || undefined, toolVersion: pkg.version }, config, configFile),
});
