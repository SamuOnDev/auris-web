/**
 * Base content model: texts + images only.
 *
 * - `images`  maps a slot name (e.g. "hero.background") to a URL. The URL is either a
 *             static "/images/..." path baked into the design, or a Vercel Blob URL after
 *             an upload.
 * - `text`    maps a language code to a set of overrides (key -> string). Only overridden
 *             keys are stored; missing keys fall back to the i18n dictionary.
 *
 * To add a repeatable collection (portfolio, products, ...), see docs/04-extensions.md.
 */
export type LocaleOverrides = Record<string, string>;

export interface CmsData {
    images: Record<string, string>;
    text: Record<string, LocaleOverrides>;
}
