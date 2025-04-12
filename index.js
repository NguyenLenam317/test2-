import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;

// Create HTTP server
const server = http.createServer(app);

// Enable JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      console.log(logLine);
    }
  });

  next();
});

// Try to load API routes from server/routes.js if it exists in dist folder
try {
  const routesPath = path.join(__dirname, 'server/routes.js');
  if (fs.existsSync(routesPath)) {
    console.log('Loading API routes from server/routes.js');
    import('./server/routes.js')
      .then(module => {
        if (typeof module.registerRoutes === 'function') {
          module.registerRoutes(app, server);
          console.log('API routes registered successfully');
        } else {
          console.error('registerRoutes function not found in routes module');
        }
      })
      .catch(err => {
        console.error('Failed to load routes:', err);
      });
  } else {
    console.log('No routes.js file found, continuing with static file serving only');
  }
} catch (err) {
  console.error('Error loading routes:', err);
}

// Serve static files from the 'dist/public' directory
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// For any request that doesn't match a static file or API route, serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
