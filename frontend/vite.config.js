import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const VENDOR_CHUNKS = {
  react: ['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'],
  data: ['@tanstack/query-core', '@tanstack/react-query', 'axios', 'socket.io-client', 'engine.io-client'],
  forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Same-origin in development: the httpOnly refresh cookie just works, no CORS preflights.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/socket.io': { target: apiTarget, ws: true, changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Long-term cacheable vendor chunks that rarely change between deploys.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            const group = Object.entries(VENDOR_CHUNKS).find(([, packages]) =>
              packages.some((pkg) => id.includes(`/node_modules/${pkg}/`)),
            );
            return group?.[0];
          },
        },
      },
    },
  };
});
