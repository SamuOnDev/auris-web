/**
 * THE MAPPING — declares which texts and images of this site are editable from /admin.
 *
 * - Text fields reference i18n keys; their default value lives in src/i18n/locales/*.json.
 * - Image slots reference cms.images keys; their default asset lives under /public.
 *
 * The /admin SPA renders its "Textos" and "Imágenes" screens directly from these lists.
 * Public pages render the same keys/slots through the override helpers in
 * src/lib/page-content.ts (makeText / img) so edits take effect.
 */

export interface EditableTextField {
    key: string;
    label: string;
    multiline?: boolean;
    /** Render with set:html on the public page; field accepts inline tags like <b>. */
    allowsHtml?: boolean;
}

export interface EditableTextGroup {
    id: string;
    title: string;
    fields: EditableTextField[];
}

export const TEXT_GROUPS: EditableTextGroup[] = [
    {
        id: "brand_nav",
        title: "Marca y navegación",
        fields: [
            { key: "badge", label: "Eslogan bajo el logo" },
            { key: "nav_home", label: "Menú · Inicio" },
            { key: "nav_about", label: "Menú · Quiénes somos" },
            { key: "nav_where", label: "Menú · Dónde estamos" },
            { key: "nav_contact", label: "Menú · Contacto (botón)" },
        ],
    },
    {
        id: "home_hero1",
        title: "Inicio · Hero principal",
        fields: [
            { key: "h1a", label: "Título — parte 1" },
            { key: "h1b", label: "Título — parte destacada (verde)" },
            { key: "h1c", label: "Título — parte 3" },
            { key: "sub", label: "Subtítulo", multiline: true },
            { key: "sub_alt", label: "Texto secundario", multiline: true },
            { key: "cta_primary", label: "Botón principal" },
            { key: "cta_secondary", label: "Botón secundario" },
            { key: "home_languages_line", label: "Línea de idiomas (bajo botones)" },
            { key: "home_hero_primary_alt", label: "Texto alternativo de la imagen" },
        ],
    },
    {
        id: "home_specialties",
        title: "Inicio · Especialidades",
        fields: [
            { key: "home_specialties_eyebrow", label: "Antetítulo" },
            { key: "home_specialties_title_a", label: "Título — parte 1" },
            { key: "home_specialties_title_b", label: "Título — parte destacada (verde)" },
            { key: "home_specialties_sub", label: "Texto introductorio", multiline: true },
            { key: "home_spec_trauma_title", label: "1 · Trauma — título" },
            { key: "home_spec_trauma_desc", label: "1 · Trauma — descripción", multiline: true },
            { key: "home_spec_ansiedad_title", label: "2 · Ansiedad — título" },
            { key: "home_spec_ansiedad_desc", label: "2 · Ansiedad — descripción", multiline: true },
            { key: "home_spec_animo_title", label: "3 · Estado de ánimo — título" },
            { key: "home_spec_animo_desc", label: "3 · Estado de ánimo — descripción", multiline: true },
            { key: "home_spec_duelo_title", label: "4 · Duelos — título" },
            { key: "home_spec_duelo_desc", label: "4 · Duelos — descripción", multiline: true },
            { key: "home_spec_tdah_title", label: "5 · TDAH — título" },
            { key: "home_spec_tdah_desc", label: "5 · TDAH — descripción", multiline: true },
            { key: "home_spec_crisis_title", label: "6 · Crisis — título" },
            { key: "home_spec_crisis_desc", label: "6 · Crisis — descripción", multiline: true },
        ],
    },
    {
        id: "home_hero2",
        title: "Inicio · Hero secundario",
        fields: [
            { key: "h1a2", label: "Título — parte 1" },
            { key: "h1b2", label: "Título — parte destacada (verde)" },
            { key: "h1c2", label: "Título — parte 3" },
            { key: "sub2", label: "Subtítulo", multiline: true },
            { key: "sub_alt2", label: "Texto secundario", multiline: true },
            { key: "home_hero_secondary_alt", label: "Texto alternativo de la imagen" },
        ],
    },
    {
        id: "home_pillars",
        title: "Inicio · Pilares y CTA final",
        fields: [
            { key: "home_pillars_eyebrow", label: "Antetítulo" },
            { key: "home_pillars_title_a", label: "Título — parte 1" },
            { key: "home_pillars_title_b", label: "Título — parte destacada (verde)" },
            { key: "home_pillars_title_c", label: "Título — parte 3" },
            { key: "home_pillar_team_title", label: "Pilar 1 — título" },
            { key: "home_pillar_team_desc", label: "Pilar 1 — descripción", multiline: true },
            { key: "home_pillar_multilang_title", label: "Pilar 2 — título" },
            { key: "home_pillar_multilang_desc", label: "Pilar 2 — descripción", multiline: true },
            { key: "home_pillar_evidence_title", label: "Pilar 3 — título" },
            { key: "home_pillar_evidence_desc", label: "Pilar 3 — descripción", multiline: true },
            { key: "home_finalcta_title", label: "CTA final — título" },
            { key: "home_finalcta_body", label: "CTA final — texto", multiline: true },
        ],
    },
    {
        id: "about",
        title: "Quiénes somos",
        fields: [
            { key: "about_title", label: "Título" },
            { key: "about_intro", label: "Introducción", multiline: true },
            { key: "about_team_title", label: "Equipo — título" },
            { key: "about_team_intro", label: "Equipo — introducción", multiline: true },
            { key: "about_member_ana_name", label: "Miembro 1 — nombre" },
            { key: "about_member_ana_role", label: "Miembro 1 — cargo" },
            { key: "about_member_ana_details", label: "Miembro 1 — detalles" },
            { key: "about_member_ana_bio", label: "Miembro 1 — biografía (separa párrafos con línea en blanco)", multiline: true },
            { key: "about_member_ana_image_alt", label: "Miembro 1 — texto alternativo foto" },
            { key: "about_member_javier_name", label: "Miembro 2 — nombre" },
            { key: "about_member_javier_role", label: "Miembro 2 — cargo" },
            { key: "about_member_javier_details", label: "Miembro 2 — detalles" },
            { key: "about_member_javier_bio", label: "Miembro 2 — biografía", multiline: true },
            { key: "about_member_javier_image_alt", label: "Miembro 2 — texto alternativo foto" },
            { key: "about_finalcta_title", label: "CTA final — título" },
            { key: "about_finalcta_body", label: "CTA final — texto", multiline: true },
        ],
    },
    {
        id: "where",
        title: "Dónde estamos",
        fields: [
            { key: "where_intro", label: "Introducción", multiline: true },
            { key: "where_address_label", label: "Etiqueta — Dirección" },
            { key: "where_phone_label", label: "Etiqueta — Teléfono" },
            { key: "where_phone_helper", label: "Teléfono — texto de apoyo" },
            { key: "where_map_title", label: "Mapa — título accesible" },
            { key: "where_hours_label", label: "Horario — etiqueta" },
            { key: "where_hours_weekdays_label", label: "Horario — lunes-jueves (etiqueta)" },
            { key: "where_hours_weekdays_value", label: "Horario — lunes-jueves (valor)" },
            { key: "where_hours_friday_label", label: "Horario — viernes (etiqueta)" },
            { key: "where_hours_friday_value", label: "Horario — viernes (valor)" },
            { key: "where_hours_weekend_label", label: "Horario — fin de semana (etiqueta)" },
            { key: "where_hours_weekend_value", label: "Horario — fin de semana (valor)" },
            { key: "where_directions_label", label: "Cómo llegar — etiqueta" },
            { key: "where_directions_metro1", label: "Cómo llegar — metro 1" },
            { key: "where_directions_metro2", label: "Cómo llegar — metro 2" },
            { key: "where_directions_bus", label: "Cómo llegar — bus" },
            { key: "where_directions_link", label: "Cómo llegar — texto del enlace" },
            { key: "where_finalcta_title", label: "CTA final — título" },
            { key: "where_finalcta_body", label: "CTA final — texto", multiline: true },
        ],
    },
    {
        id: "contact_intro",
        title: "Contacto · Cabecera y tarjetas",
        fields: [
            { key: "contact_eyebrow", label: "Antetítulo" },
            { key: "contact_hero_title_a", label: "Título — parte 1" },
            { key: "contact_hero_title_b", label: "Título — parte destacada (verde)" },
            { key: "contact_hero_title_c", label: "Título — parte 3" },
            { key: "contact_hero_sub", label: "Subtítulo", multiline: true },
            { key: "contact_card_phone_label", label: "Tarjeta — etiqueta Teléfono" },
            { key: "contact_card_email_label", label: "Tarjeta — etiqueta Email" },
            { key: "contact_card_visit_label", label: "Tarjeta — etiqueta Visítanos" },
            { key: "contact_card_visit_value", label: "Tarjeta — dirección visible" },
            { key: "contact_languages_label", label: "Idiomas — etiqueta" },
            { key: "contact_form_title", label: "Formulario — título" },
            { key: "contact_form_sub", label: "Formulario — subtítulo", multiline: true },
            { key: "contact_title", label: "Título alternativo (legacy)" },
        ],
    },
    {
        id: "contact_form",
        title: "Contacto · Formulario (etiquetas)",
        fields: [
            { key: "contact_name_label", label: "Campo — Nombre" },
            { key: "contact_email_label", label: "Campo — Email" },
            { key: "contact_message_label", label: "Campo — Mensaje" },
            { key: "contact_submit", label: "Botón enviar" },
        ],
    },
    {
        id: "footer",
        title: "Pie de página",
        fields: [
            { key: "footer_rights", label: "Derechos reservados" },
            { key: "footer_legal", label: "Título — Información legal" },
            { key: "footer_privacy", label: "Enlace — Política de privacidad" },
            { key: "footer_terms", label: "Enlace — Términos y condiciones" },
            { key: "footer_cookies", label: "Enlace — Política de cookies" },
        ],
    },
    {
        id: "cookie_banner",
        title: "Banner de cookies",
        fields: [
            { key: "cookie_banner_title", label: "Título" },
            { key: "cookie_banner_body", label: "Texto", multiline: true },
            { key: "cookie_banner_more_info", label: "Enlace — más información" },
            { key: "cookie_banner_reject", label: "Botón — rechazar" },
            { key: "cookie_banner_accept", label: "Botón — aceptar" },
        ],
    },
    {
        id: "cookie_policy",
        title: "Política de cookies (página)",
        fields: [
            { key: "cookie_policy_heading", label: "Título" },
            { key: "cookie_policy_intro", label: "Introducción", multiline: true },
            { key: "cookie_policy_what_are_title", label: "¿Qué son? — título" },
            { key: "cookie_policy_what_are_body", label: "¿Qué son? — texto", multiline: true },
            { key: "cookie_policy_types_title", label: "Tipos — título" },
            { key: "cookie_policy_types_necessary", label: "Tipos — necesarias", multiline: true },
            { key: "cookie_policy_types_functional", label: "Tipos — personalización", multiline: true },
            { key: "cookie_policy_types_analytics", label: "Tipos — analíticas", multiline: true },
            { key: "cookie_policy_management_title", label: "Gestión — título" },
            { key: "cookie_policy_management_body", label: "Gestión — texto", multiline: true },
            { key: "cookie_policy_changes_title", label: "Actualizaciones — título" },
            { key: "cookie_policy_changes_body", label: "Actualizaciones — texto", multiline: true },
            { key: "cookie_policy_contact_title", label: "Contacto — título" },
            { key: "cookie_policy_contact_body", label: "Contacto — texto" },
            { key: "cookie_policy_contact_email", label: "Contacto — email" },
            { key: "cookie_policy_last_updated", label: "Última actualización" },
        ],
    },
];

export const TEXT_KEYS: string[] = TEXT_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

export interface EditableImageSlot {
    slot: string;
    label: string;
    hint?: string;
}

export const IMAGE_SLOTS: EditableImageSlot[] = [
    { slot: "brand.logo", label: "Logotipo (cabecera)", hint: "Cuadrado, PNG con transparencia" },
    { slot: "hero.primary", label: "Inicio · Imagen hero principal", hint: "Vertical, aprox. 323×523 px · JPG/PNG/WebP" },
    { slot: "hero.secondary", label: "Inicio · Imagen hero secundaria", hint: "Horizontal, aprox. 1280×853 px" },
    { slot: "about.esther", label: "Quiénes somos · Foto miembro 1", hint: "Aprox. 450×360 px" },
    { slot: "about.javier", label: "Quiénes somos · Foto miembro 2", hint: "Aprox. 740×493 px" },
];
