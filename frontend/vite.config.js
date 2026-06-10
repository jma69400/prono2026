import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    // Optimisations bundle pour réduire le temps de chargement initial
    target: 'es2020',           // browsers modernes uniquement (Sep 2020+)
    minify: 'esbuild',          // 10x plus rapide que terser, ratio quasi identique
    cssMinify: true,
    sourcemap: false,           // pas de sourcemaps en prod (économise ~30% de taille)
    chunkSizeWarningLimit: 1500, // notre App.jsx est gros, on accepte
    rollupOptions: {
      output: {
        // === CODE-SPLITTING ===
        // Sépare les grosses dépendances en chunks séparés.
        // Bénéfice : si on update App.jsx, le user ne re-télécharge PAS les libs (cachées).
        // Bénéfice 2 : parallel download de chunks = plus rapide au 1er chargement.
        manualChunks: {
          // React/ReactDOM (toujours nécessaire, mais cacheable indéfiniment)
          'vendor-react': ['react', 'react-dom'],
          // Lucide icons : ~50 KB, change rarement
          'vendor-icons': ['lucide-react'],
        },
        // Nommage avec hash pour cache-busting automatique
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
