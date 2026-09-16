import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/CanTheA4Trung/' : '/',
  plugins: [react()],
  worker: { format: 'iife' },
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
