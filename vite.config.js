import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget =
    env.VITE_DEV_API_PROXY ||
    env.VITE_SPOTIFY_API_BASE_URL ||
    'https://pixel-start.vercel.app'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './')
      }
    },
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true
    },
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: true
        }
      }
    }
  }
})
