import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// URL pública del sitio: VITE_SITE_URL o, en Vercel, el dominio de producción del proyecto
const SITE_URL = (process.env.VITE_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  || '').replace(/\/$/, '')

// Páginas públicas que se ofrecen a los buscadores (el resto de la app exige sesión)
const PUBLIC_PAGES = ['/inicio', '/', '/registro']

// SEO al compilar: URL absolutas de la vista previa (og:url, og:image) y robots.txt + sitemap.xml
function seo() {
  return {
    name: 'seo',
    apply: 'build',
    transformIndexHtml() {
      const tags = []
      // Código de verificación de Google Search Console (método «Etiqueta HTML»)
      const verification = process.env.VITE_GOOGLE_SITE_VERIFICATION
      if (verification) tags.push({ tag: 'meta', attrs: { name: 'google-site-verification', content: verification }, injectTo: 'head' })
      if (!SITE_URL) return tags
      const meta = (property, content) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' })
      return [
        ...tags,
        meta('og:url', `${SITE_URL}/inicio`),
        meta('og:image', `${SITE_URL}/og-image.png`),
        meta('og:image:width', '1200'),
        meta('og:image:height', '630'),
        meta('og:image:alt', 'BikeTelemetry: cada kilómetro, medido'),
      ]
    },
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', 'Disallow: /api/', SITE_URL && `Sitemap: ${SITE_URL}/sitemap.xml`]
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots.filter(Boolean).join('\n')}\n` })
      if (!SITE_URL) return
      const urls = PUBLIC_PAGES.map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seo()],
  resolve: {
    // Alias @/ → src/ (lo usan los componentes de shadcn/ui)
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // En desarrollo, /api se redirige al backend Express (npm run dev en la raíz)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
