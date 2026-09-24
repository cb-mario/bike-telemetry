import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En desarrollo, /api se redirige al backend Express (npm run dev en la raíz)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
