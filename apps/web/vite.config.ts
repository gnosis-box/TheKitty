import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Allow dev-server access through HTTPS tunnels (cloudflared, ngrok,
    // localtunnel) so the Circles playground iframe can load the app while
    // we iterate locally.
    allowedHosts: [
      '.trycloudflare.com',
      '.ngrok-free.app',
      '.ngrok.app',
      '.ngrok.io',
      '.loca.lt',
    ],
  },
});
