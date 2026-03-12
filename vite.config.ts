import path from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  root: path.resolve(__dirname, 'src/popup'),
  publicDir: path.resolve(__dirname, 'public')
});