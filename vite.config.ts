import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const vapidPublicKey = env.VITE_VAPID_PUBLIC_KEY || '';
  return {
    plugins: [react(), tailwindcss()],
    define: {
      '__VAPID_PUBLIC_KEY__': JSON.stringify(vapidPublicKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Split stable vendors from app code: repeat visits load only the
          // (small) app chunk from the network — vendors stay cached.
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'supabase': ['@supabase/supabase-js'],
            'motion': ['motion'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
