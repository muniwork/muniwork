import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  adapter: netlify(),
  vite: {
    plugins: [tailwindcss()],
  },
});
