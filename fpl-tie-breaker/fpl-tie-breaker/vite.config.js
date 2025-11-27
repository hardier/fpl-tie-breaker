import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/tie-breaker/', // Keeps the asset links correct
  // We removed the 'build' block to let Vercel handle the output normally
})