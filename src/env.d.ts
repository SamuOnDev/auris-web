/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        lang: import('./i18n').Lang;
    }
}

interface ImportMetaEnv {
    readonly N8N_WEBHOOK_URL?: string;
    readonly RESEND_API_KEY?: string;
    readonly TO_EMAIL?: string;
    readonly FROM_EMAIL?: string;
    readonly PUBLIC_RECAPTCHA_SITE_KEY?: string;
    readonly RECAPTCHA_SECRET_KEY?: string;
    readonly RECAPTCHA_MIN_SCORE?: string;
    readonly CONTACT_ALLOWED_ORIGINS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}