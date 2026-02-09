import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separate vendor libraries into their own chunks
          
          // React and React Router
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor'
          }
          
          // Three.js
          if (id.includes('three') || id.includes('@types/three')) {
            return 'three-vendor'
          }
          
          // Phaser
          if (id.includes('phaser')) {
            return 'phaser-vendor'
          }
          
          // Pathfinding
          if (id.includes('pathfinding')) {
            return 'pathfinding-vendor'
          }
          
          // Node modules (other dependencies)
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1500, // Phaser is a large library (~1.2MB), acceptable for lazy-loaded chunks
  },
})
