// Compila la pieza de inicio de sesión a www/js/cuenta/. El juego la carga solo si hay un App ID de Privy.
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: './',
  plugins: [nodePolyfills()],
  build: {
    outDir: '../www/js/cuenta',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: 'src/main.js',
      preserveEntrySignatures: 'exports-only',
      output: { format: 'es', entryFileNames: 'cuenta.js', chunkFileNames: 'trozos/[name]-[hash].js', assetFileNames: 'trozos/[name]-[hash][extname]' },
    },
  },
});
