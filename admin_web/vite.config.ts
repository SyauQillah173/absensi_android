import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: false, // Mematikan source map agar kode asli TypeScript tidak bisa dibongkar di browser DevTools
    minify: 'esbuild', // Minifikasi & pengaburan kode (obfuscation) secara intensif
    cssMinify: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-excel': ['xlsx-js-style', 'jszip'],
          'vendor-charts': ['recharts'],
          'vendor-qr': ['qrcode']
        }
      }
    }
  },
  esbuild: {
    drop: ['console', 'debugger'] // Menghapus otomatis seluruh console.log dan debugger pada build produksi
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://absensi-android.vercel.app',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
