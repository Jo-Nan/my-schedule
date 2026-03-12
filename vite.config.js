import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Custom plugin to handle local file saving
const localSyncPlugin = () => ({
  name: 'local-sync-plugin',
  configureServer(server) {
    const dataFileName = 'plans.json';
    const macDataDir = '/Users/muzinan/NanMuZ/Code/day/public/data';
    const winDataDir = 'D:/Code/day/public/data';
    const fallbackDataDir = path.resolve(__dirname, 'public/data');

    const getTargetFileInfo = () => {
      const isMac = process.platform === 'darwin';
      const isWin = process.platform === 'win32';

      if (isMac && fs.existsSync(macDataDir)) {
        return path.join(macDataDir, dataFileName);
      }

      if (isWin) {
        return path.join(winDataDir, dataFileName);
      }

      return path.join(fallbackDataDir, dataFileName);
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
