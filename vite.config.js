import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'three': 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.module.js',
      'lil-gui': 'https://cdn.jsdelivr.net/npm/lil-gui@0.20.0/+esm',
      '@sparkjsdev/spark': '/spark.module.js'
    }
  },
  server: {
    host: true, // Allow access from network (needed for VR headsets)
    port: 3000,
    open: true,
    cors: true,
    // Enable HTTPS for WebXR (required for VR headsets)
    // Try to use mkcert certificates if available, otherwise use Vite's auto-generated certs
    https: (() => {
      const certPath = path.join(__dirname, 'localhost+2.pem');
      const keyPath = path.join(__dirname, 'localhost+2-key.pem');
      
      // Check if mkcert certificates exist
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        return {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath)
        };
      }
      
      // Fallback to Vite's auto-generated certificate
      return true;
    })(),
    // Increase header size limit to handle large file requests
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      // WebXR requires these headers
      'Permissions-Policy': 'xr-spatial-tracking=*'
    },
    // Increase file size limits for large assets
    fs: {
      // Allow serving files from outside the project root
      allow: ['..']
    },
    // Custom middleware to handle large files without truncation
    middlewareMode: false,
  },
  plugins: [
    {
      name: 'large-file-handler',
      configureServer(server) {
        server.middlewares.use('/assets', (req, res, next) => {
          if (req.url && req.url.endsWith('.spz')) {
            const filePath = path.join(process.cwd(), 'public', req.url);
            if (fs.existsSync(filePath)) {
              const stat = fs.statSync(filePath);
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Length', stat.size);
              res.setHeader('Accept-Ranges', 'bytes');
              const stream = fs.createReadStream(filePath);
              stream.pipe(res);
              return;
            }
          }
          next();
        });
      }
    }
  ],
  build: {
    outDir: 'dist',
    target: 'es2022', // Support top-level await
    assetsInlineLimit: 0 // Don't inline assets
  },
  optimizeDeps: {
    exclude: ['three', 'lil-gui', '@sparkjsdev/spark']
  },
  assetsInclude: ['**/*.spz', '**/*.mp3', '**/*.png']
});

