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
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}