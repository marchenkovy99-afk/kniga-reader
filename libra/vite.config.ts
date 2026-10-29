import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.LIBRA_BASE_PATH || '/',
  build: { target: 'es2022', outDir: 'dist' },
  test: { environment: 'jsdom' }
});
