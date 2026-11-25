import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative base ensures assets load both on Vercel and inside Facebook Instant Games CDN bundles
  base: './',
  plugins: [react(), tailwindcss()],
});
