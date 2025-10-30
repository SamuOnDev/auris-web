// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';


// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
  }),
  // Tailwind CSS se procesa a través de PostCSS (ver postcss.config.cjs),
  // no es necesario añadir plugins adicionales aquí.
});