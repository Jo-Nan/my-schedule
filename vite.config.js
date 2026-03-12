import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Custom plugin to handle local file saving
const localSyncPlugin = () => ({
  name: 'local-sync-plugin',
  configureServer(server) {
    const getTargetFileInfo = () => {
      const isWin = process.platform === 'win32';
      const macPath = '/Users/muzinan/NanMuZ/Code/day/public/data/plans.json';
      const winPath = 'D:/Code/day/public/data/plans.json';
      const preferredPath = isWin ? winPath : macPath;
      const relativePath = path.resolve(__dirname, 'public/data/plans.json');
      
      // Use preferred path if it exists or we can create it in its parent dir
      const preferredDir = path.dirname(preferredPath);
      if (fs.existsSync(preferredDir)) {
        return preferredPath;
      }
      return relativePath;
    };

    server.middlewares.use((req, res, next) => {
      const targetPath = getTargetFileInfo();

      if (req.url?.startsWith('/api/load-plans') && req.method === 'GET') {
        try {
          if (fs.existsSync(targetPath)) {
            const data = fs.readFileSync(targetPath, 'utf-8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ status: 'error', message: 'File not found' }));
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        }
      } else if (req.url === '/api/save-plans' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'success', path: targetPath }));
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
