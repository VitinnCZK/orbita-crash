import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * No build: põe o CSS (~3 kB gzip) direto no HTML, sem uma requisição que bloqueia a
 * primeira pintura, e pede as fontes já no HTML, antes do React montar a página.
 */
function inlineCssAndPreloadFonts(): Plugin {
  return {
    name: 'inline-css-preload-fonts',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const tags: { tag: string; attrs: Record<string, string | boolean>; injectTo: 'head' }[] = [];
      for (const [fileName, chunk] of Object.entries(ctx.bundle)) {
        if (chunk.type !== 'asset') continue;
        if (fileName.endsWith('.css')) {
          const link = new RegExp(`<link rel="stylesheet"[^>]*href="/${fileName}"[^>]*>`);
          // O preload dos imports dinâmicos do Vite ainda pede este CSS, a menos que ache um
          // <link rel="stylesheet"> com o mesmo href. O link desativado satisfaz essa checagem
          // sem baixar nada; o arquivo continua publicado caso algum navegador o peça.
          html = html.replace(
            link,
            () => `<style>${String(chunk.source)}</style><link rel="stylesheet" href="/${fileName}" disabled>`,
          );
        } else if (/(lilita-one-latin-400|nunito-latin-700)-normal-.*\.woff2$/.test(fileName)) {
          tags.push({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${fileName}`, crossorigin: true },
            injectTo: 'head',
          });
        }
      }
      return { html, tags };
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineCssAndPreloadFonts()],
  server: { host: true, port: 5173 },
});
