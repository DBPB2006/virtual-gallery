import path from "path"
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    proxy: {
      '/api/auth': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/api/verification': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/api/payments': {
        target: 'http://localhost:5002',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5050',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5050',
        ws: true,
        changeOrigin: true
      }
    }
  },
})
