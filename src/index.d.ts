import type { Report, Rule } from './core.js';
export * from './core.js';
export interface ConsentOptions {
  baseUrl?: string; include?: string[]; exclude?: string[]; cleanUrls?: boolean;
  /** Extra vendor ids treated as strictly necessary. */
  essential?: string[];
  /** Do not report embeds (video, maps, fonts, social) that load before consent. */
  allowEmbeds?: boolean;
  /** The CMP injects its own persistent settings button. */
  cmpProvidesWithdraw?: boolean;
  now?: Date; toolVersion?: string; [option: string]: unknown;
}
export declare const RULES: Record<string, Rule>;
export declare const SITE_OPTIONS: Record<string, { type: 'string' | 'boolean'; multiple?: boolean }>;
export declare const SITE_HELP: string;
export declare function check(dir: string, opts?: ConsentOptions, config?: Record<string, unknown>, configFile?: string): Report;
export declare function analyze(site: unknown, opts?: ConsentOptions, config?: Record<string, unknown>): { findings: Report['findings']; info: Record<string, unknown>; summary: string };
