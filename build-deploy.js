import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run a command and return a promise
function runCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command}`);
    exec(command, (error, stdout, stderr) => {
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

// Copy directory recursively
async function copyDir(src, dest) {
  try {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
    return true;
  } catch (error) {
    console.error(`Error copying directory from ${src} to ${dest}:`, error);
    return false;
  }
}

async function build() {
  try {
    // Build frontend with Vite
    console.log('Building frontend with Vite...');
    await runCommand('npx vite build');
    
    // Copy server directory to dist for deployment
    console.log('Copying server files to dist...');
    const serverSrc = path.join(__dirname, 'server');
    const serverDest = path.join(__dirname, 'dist', 'server');
    await copyDir(serverSrc, serverDest);
    
    // Copy shared directory if it exists
    try {
      console.log('Copying shared files to dist...');
      const sharedSrc = path.join(__dirname, 'shared');
      const sharedDest = path.join(__dirname, 'dist', 'shared');
      await copyDir(sharedSrc, sharedDest);
    } catch (err) {
      console.log('No shared directory or error copying shared files');
    }
    
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
