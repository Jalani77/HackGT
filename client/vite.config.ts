import path from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, '..'), '');
  // Camera APIs need a secure context. localhost is fine; phones on the LAN need HTTPS.
  const https = env.VITE_HTTPS === '1';
  const apiTarget = `http://localhost:${env.PORT || 4000}`;

  return {
    envDir: '..',
    plugins: [react(), tailwindcss(), ...(https ? [basicSsl()] : [])],
    resolve: { alias: { '@shared': path.resolve(import.meta.dirname, '../shared') } },
    server: {
      host: true,
      port: 5173,
      // Same-origin proxy: the browser never talks to the API or AI provider directly.
      proxy: { '/api': apiTarget, '/uploads': apiTarget },
    },
  };
});
