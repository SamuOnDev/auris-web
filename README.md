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

Las siguientes variables son opcionales y permiten integrar el formulario de contacto con servicios externos y mecanismos anti-spam:

- `N8N_WEBHOOK_URL`
- `RESEND_API_KEY`
- `TO_EMAIL`
- `FROM_EMAIL`
- `PUBLIC_RECAPTCHA_SITE_KEY`
- `RECAPTCHA_SECRET_KEY`
- `RECAPTCHA_MIN_SCORE`

Configúralas en tu entorno de desarrollo y en el panel de Vercel si las necesitas.

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