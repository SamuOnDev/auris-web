import type { CmsData } from "./cms-types";

/**
 * Default image slots. The key is the slot name read by public pages; the value is the
 * original design asset committed under /public. Add one entry per editable image.
 *
 * These doubles as the public-page fallback: a page can read either
 *   cms.images["hero.background"] ?? DEFAULT_IMAGES["hero.background"]
 * but in practice pages hardcode their own fallback path next to the markup.
 */
export const DEFAULT_IMAGES: Record<string, string> = {
    "hero.primary": "/hero.png",
    "hero.secondary": "/hero_second.jpg",
    "about.esther": "/team-esther.png",
    "about.javier": "/team-jordi.jpg",
    "brand.logo": "/logo2.png",
};

/**
 * Text defaults live in the i18n dictionaries (src/i18n/locales/*.json), NOT here.
 * The CMS `text` map only ever holds overrides, so defaults start empty per language.
 */
export function buildDefaults(): CmsData {
    return {
        images: { ...DEFAULT_IMAGES },
        text: {},
    };
}
