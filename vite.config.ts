import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Repository site: username.github.io/trn/. Set VITE_BASE=/ for a custom domain.
  base: process.env.VITE_BASE || '/trn/',
});
