import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'single-react-runtime',
      generateBundle() {
        const marker = '/node_modules/react/'
        const roots = new Set<string>()
        for (const id of this.getModuleIds()) {
          const cleanId = id.split('?')[0]
          const index = cleanId.lastIndexOf(marker)
          if (index >= 0) roots.add(cleanId.slice(0, index + marker.length - 1))
        }
        if (roots.size !== 1) this.error(`Expected one React runtime, found ${roots.size}`)
      },
    },
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
