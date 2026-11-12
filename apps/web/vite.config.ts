import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // Proxy rather than CORS: the browser talks to the Vite origin, and the
    // api client can use plain relative paths.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
