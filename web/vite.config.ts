import { defineConfig } from 'vite';

// Same-origin API in development and preview. Production uses a reverse proxy.
const proxy={'/api':{target:'http://localhost:8079',changeOrigin:true}};
export default defineConfig({server:{port:5173,strictPort:true,proxy},preview:{port:4173,strictPort:true,proxy}});
