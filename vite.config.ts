import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // CRITICAL: Check both process.env (for GitHub Actions) and loaded .env (for local)
  // This ensures the secret is actually passed to the build
  const apiKey = process.env.API_KEY || env.API_KEY || env.VITE_API_KEY;

  return {
    plugins: [react()],
    base: './', // CRITICAL: Ensures assets load correctly on shared hosting subdirectories
    define: {
      // Expose env variables safely to the client. 
      'process.env.API_KEY': JSON.stringify(apiKey)
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'recharts', 'lucide-react', 'jspdf'],
            ai: ['@google/genai']
          }
        }
      }
    }
  };
});