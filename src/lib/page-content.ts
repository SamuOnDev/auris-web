/**
 * Override helpers for public pages.
 *
 * The CMS store only ever holds OVERRIDES; the design defaults live in the i18n
 * dictionaries (text) and under /public (images). Pages render through these helpers so
 * that an empty store renders the site exactly as designed (override ?? default).
 */
import type { CmsData } from "./cms-types";
import { t, type ActiveLang, type TranslationKey } from "../i18n";

/** Build a text() helper bound to a language and the loaded CMS overrides. */
export function makeText(lang: ActiveLang, cms: CmsData): (key: TranslationKey) => string {
    const overrides = cms.text?.[lang] ?? {};
    return (key: TranslationKey): string => {
        const override = overrides[key];
        return typeof override === "string" && override.length > 0 ? override : t(lang, key);
    };
}

/** Return the overridden image URL for a slot, or the design's default asset path. */
export function img(cms: CmsData, slot: string, fallback: string): string {
    const value = cms.images?.[slot];
    return typeof value === "string" && value.length > 0 ? value : fallback;
}
