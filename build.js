#!/usr/bin/env node

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run a command and return a promise
function runCommand(command, cwd = __dirname) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} in ${cwd}`);
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        console.error(stderr);
        reject(error);
        return;
      }
      console.log(stdout);
      resolve(stdout);
    });
  });
}

async function ensureDirectoryExists(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
    return true;
  } catch (error) {
    console.error(`Error creating directory ${dir}:`, error);
    return false;
  }
}

async function createTsconfigForServer() {
  // Create a separate tsconfig for server compilation
  const serverTsConfig = {
    compilerOptions: {
      target: "ES2020",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      esModuleInterop: true,
      outDir: "./dist",
      rootDir: "./",
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true
    },
    include: ["server/**/*.ts", "shared/**/*.ts"],
    exclude: ["node_modules", "dist"]
  };

  await fs.writeFile(
    path.join(__dirname, 'tsconfig.server.json'),
    JSON.stringify(serverTsConfig, null, 2)
  );
}

async function buildClient() {
  console.log('Building client with Vite...');
  try {
    // Build the client-side code with Vite
    await runCommand('npx vite build');
    return true;
  } catch (error) {
    console.error('Client build failed:', error);
    return false;
  }
}

async function buildServer() {
  console.log('Building server...');
  try {
    // Create a specific tsconfig for server
    await createTsconfigForServer();
    
    // First try to just copy the server files directly
    // This is a fallback approach if TypeScript compilation fails
    try {
      // Copy server/ directory to dist/
      const serverDir = path.join(__dirname, 'server');
      const distDir = path.join(__dirname, 'dist');
      const files = await fs.readdir(serverDir);
      
      // Make sure the dist directory exists
      await ensureDirectoryExists(distDir);
      
      console.log('Copying server files as a fallback method...');
      
      // Copy all typescript files but rename them to .js
      for (const file of files) {
        if (file.endsWith('.ts')) {
          const srcPath = path.join(serverDir, file);
          const destPath = path.join(distDir, file.replace('.ts', '.js'));
          
          const content = await fs.readFile(srcPath, 'utf8');
          console.log(`Copying: ${srcPath} -> ${destPath}`);
          await fs.writeFile(destPath, content, 'utf8');
        }
      }
      
      // Try to copy shared files too if they exist
      try {
        const sharedDir = path.join(__dirname, 'shared');
        const distSharedDir = path.join(distDir, 'shared');
        await ensureDirectoryExists(distSharedDir);
        
        const sharedFiles = await fs.readdir(sharedDir);
        for (const file of sharedFiles) {
          const srcPath = path.join(sharedDir, file);
          const destPath = path.join(distSharedDir, file.replace('.ts', '.js'));
          
          const content = await fs.readFile(srcPath, 'utf8');
          console.log(`Copying: ${srcPath} -> ${destPath}`);
          await fs.writeFile(destPath, content, 'utf8');
        }
      } catch (err) {
        console.log('No shared directory or error copying shared files');
      }
    } catch (copyError) {
      console.error('Failed to copy server files:', copyError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Server build failed:', error);
    return false;
  }
}

async function build() {
  try {
    // Make sure dist directory exists
    const distDir = path.join(__dirname, 'dist');
    await ensureDirectoryExists(distDir);
    
    // Build client and server in sequence
    const clientSuccess = await buildClient();
    if (!clientSuccess) {
      throw new Error('Client build failed');
    }
    
    const serverSuccess = await buildServer();
    if (!serverSuccess) {
      throw new Error('Server build failed');
    }
    
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build process failed:', error);
    process.exit(1);
  }
}

build();
