import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {allowedHosts:['terminal.local']},
  base: process.env.LIBRA_BASE_PATH || '/',
  build: { target: 'es2022', outDir: 'dist' }
});
