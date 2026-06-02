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
  build: {
    // Split heavy vendor surfaces out of the app chunk so a cold load
    // streams them in parallel: viem, the @aboutcircles family, and
    // React each end up in their own file. Cuts initial JS roughly in
    // half on the services landing.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@aboutcircles')) return 'circles';
          if (id.includes('node_modules/viem')) return 'viem';
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router') ||
            /[\\/]node_modules[\\/]react[\\/]/.test(id) ||
            id.includes('node_modules/scheduler')
          ) {
            return 'react';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
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
