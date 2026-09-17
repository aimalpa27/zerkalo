import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    rollupOptions: {
      input: {
        main:       resolve(__dirname, 'index.html'),
        admin:      resolve(__dirname, 'admin.html'),
        kitchen:    resolve(__dirname, 'kitchen.html'),
        superadmin: resolve(__dirname, 'superadmin.html'),
      },
    },
  },
})