import path from 'path';
import { defineConfig } from '@lark-apaas/fullstack-vite-preset';

export default defineConfig({
  build: {
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@lark-apaas/client-toolkit/runtime': path.resolve(
        __dirname,
        'client/src/lib/platform-runtime.ts',
      ),
      '@lark-apaas/client-toolkit/logger': path.resolve(
        __dirname,
        'client/src/lib/logger.ts',
      ),
      '@': path.resolve(__dirname, 'client/src'),
    },
  },
});
