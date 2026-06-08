// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import vercel from '@astrojs/vercel';

// The /admin panel reads its config (ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET, KV/Blob
// tokens) from process.env so it works on Vercel at runtime. `astro dev` only exposes .env
// via import.meta.env, so we mirror the .env files into process.env for local development.
// On Vercel the platform provides the real env vars at runtime; this block only affects the
// local dev/build process and does not inline any secret into the output bundle.
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({}),
  // Tailwind CSS se procesa a través de PostCSS (ver postcss.config.cjs),
  // no es necesario añadir plugins adicionales aquí.
});