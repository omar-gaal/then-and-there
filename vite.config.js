import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@mediapipe/pose'],
  },
  resolve: {
    alias: {
      '@mediapipe/pose': '/src/stubs/mediapipe-pose-stub.js',
    },
  },
})
