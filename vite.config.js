import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Custom plugin to handle local file saving
const localSyncPlugin = () => ({
  name: 'local-sync-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/api/save-plans' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const filePath = path.resolve(__dirname, 'public/data/plans.json');
            
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            res.statusCode = 200;
            res.end(JSON.stringify({ status: 'success' }));
          } catch (err) {
            console.error('Save error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ status: 'error', message: err.message }));
          }
        });
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  base: '/my-schedule/',
  plugins: [react(), localSyncPlugin()],
})
