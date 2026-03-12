import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const popupRoot = path.resolve(projectRoot, 'src/popup');

async function renameIfExists(fromName, toName) {
  const fromPath = path.resolve(distDir, fromName);
  const toPath = path.resolve(distDir, toName);

  try {
    await fs.rename(fromPath, toPath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}

async function buildPopup() {
  await build({
    configFile: false,
    root: popupRoot,
    publicDir: path.resolve(projectRoot, 'public'),
    build: {
      outDir: distDir,
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(popupRoot, 'index.html'),
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    }
  });

  await renameIfExists('index.html', 'popup.html');
}

async function buildBackground() {
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(projectRoot, 'src/background/index.ts'),
        formats: ['es'],
        fileName: () => 'background'
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true
        }
      }
    }
  });

  await renameIfExists('background', 'background.js');
}

async function buildContent() {
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: path.resolve(projectRoot, 'src/content/index.ts'),
        formats: ['iife'],
        name: 'MobbinViewerContent',
        fileName: () => 'content'
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true
        }
      }
    }
  });

  await renameIfExists('content', 'content.js');
}

await fs.rm(distDir, { recursive: true, force: true });
await buildPopup();
await buildBackground();
await buildContent();