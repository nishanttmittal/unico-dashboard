import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base must match the GitHub Pages repo name so asset URLs resolve.
export default defineConfig({
  base: '/unico-dashboard/',
  plugins: [react(), tailwindcss()],
})
