import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(),{name:'libra-production-csp',apply:'build',transformIndexHtml:html=>html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' blob:; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' blob: https://qwnkigorqsgugcctnfmj.supabase.co wss://qwnkigorqsgugcctnfmj.supabase.co; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'"+'" />')}],
  server: {allowedHosts:['terminal.local']},
  base: process.env.LIBRA_BASE_PATH || '/',
  build: { target: 'es2022', outDir: 'dist' }
});
