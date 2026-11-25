import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Facebook Instant Games hosts unpublished/draft bundles on cookie-gated apps-*.apps.fbsbx.com.
 * Vite's default `<script type="module" crossorigin>` omits cookies (anonymous CORS), which causes
 * `apps.fbsbx.com` to reject the bundle JS/CSS and freeze the game at 0%.
 * Building a single classic IIFE bundle and stripping `type="module"` + `crossorigin` ensures
 * assets load reliably with same-origin cookies on Facebook, Mobile WebViews, AND Vercel.
 */
function fbInstantClassicHtmlPlugin(): Plugin {
  return {
    name: 'fb-instant-classic-html',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
        .replace(/<script\s+crossorigin\s+type="module"\s+src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
        .replace(/<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g, '<link rel="stylesheet" href="$1">')
        .replace(/<link\s+crossorigin\s+rel="stylesheet"\s+href="([^"]+)">/g, '<link rel="stylesheet" href="$1">');
    },
  };
}

export default defineConfig({
  // Relative base ensures assets load both on Vercel and inside Facebook Instant Games CDN bundles
  base: './',
  plugins: [react(), tailwindcss(), fbInstantClassicHtmlPlugin()],
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
