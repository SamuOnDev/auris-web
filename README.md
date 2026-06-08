# Auris International — auris.cat

Sitio web construido con [Astro](https://astro.build/) y Tailwind CSS.

## Requisitos previos

- Node.js 20.x
- npm 10.x (o pnpm/yarn si prefieres, ajustando los comandos)

Instala las dependencias con:

```bash
npm install
```

## Scripts disponibles

- `npm run dev`: inicia el servidor de desarrollo.
- `npm run build`: genera la aplicación lista para producción.
- `npm run preview`: sirve la build generada para validación manual.

## Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores para desarrollo local. En producción, configura las mismas variables como _Environment Variables_ en el panel de Vercel. Nunca commitees `.env.local`.

Variables soportadas:

- `RESEND_API_KEY`, `FROM_EMAIL`, `TO_EMAIL`: envío del formulario de contacto vía Resend.
- `EMERGENCY_FROM_EMAIL`, `EMERGENCY_TO_EMAIL`: ruta de fallback si la entrega principal falla.
- `PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE`: protección anti-spam con reCAPTCHA v3.
- `CONTACT_ALLOWED_ORIGINS`: lista separada por comas de orígenes con permiso para hacer POST a `/api/contact`.
- `N8N_WEBHOOK_URL`: integración opcional con n8n.

## Panel de administración (`/admin`)

El sitio incluye un panel oculto en `/admin` (login con usuario y contraseña, `noindex`) que
permite al cliente **editar todos los textos** —con selector por idioma (ca · es · en · de)—
y **cambiar todas las imágenes** sin tocar código. El motor sigue el patrón
`override ?? default`: con el almacén vacío, la web se muestra exactamente como el diseño;
el panel solo guarda los cambios.

- Textos por defecto: diccionarios i18n (`src/i18n/locales/*.json`).
- Imágenes por defecto: ficheros bajo `public/`.
- Qué es editable: `src/lib/editable-fields.ts` (grupos de textos + slots de imagen).
- Lectura en las páginas: `src/lib/page-content.ts` (`makeText` / `img`), con el CMS cargado
  una vez por request en el middleware (`Astro.locals.cms`).

### Almacenamiento

- **Producción**: Vercel **KV** (contenido y usuarios) + Vercel **Blob** (imágenes subidas).
- **Desarrollo**: si faltan las variables de KV/Blob, el motor cae a ficheros locales en
  `.cache/*.json` (git-ignorados). La subida de imágenes requiere Blob; editar por URL
  funciona siempre.

### Variables de entorno del panel

`ADMIN_USER`, `ADMIN_PASSWORD` (admin inicial, se crea en el primer login), `SESSION_SECRET`
(firma HMAC, ≥ 32 hex), `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `BLOB_READ_WRITE_TOKEN`,
`PUBLIC_HIDE_ADMIN_FAB`. Ver `.env.example`.

> En `astro dev`, `astro.config.mjs` vuelca los `.env` en `process.env` para que el panel
> funcione en local; en Vercel se usan las variables reales del proyecto en tiempo de ejecución.

## Despliegue en Vercel

El proyecto está preparado para ejecutarse como _serverless_ en Vercel mediante `@astrojs/vercel`:

1. Crea un proyecto en Vercel e importa este repositorio.
2. Define el comando de build como `npm run build` (Vercel lo detecta automáticamente para Astro).
3. Configura las variables de entorno necesarias.
4. Realiza el deploy; las rutas `/api` y el _middleware_ de Astro funcionarán sobre funciones serverless de Vercel.

Puedes probar localmente la build de producción con:

```bash
npm run build
npm run preview
```