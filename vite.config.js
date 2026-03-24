import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const resolveBasePath = () => {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    const repository = process.env.GITHUB_REPOSITORY || ''
    const repoName = repository.split('/')[1] || ''
    if (repoName) {
      return `/${repoName}/`
    }
  }

  return '/'
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBasePath(),
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
})
