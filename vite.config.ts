import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Hash navigation requires no host rewrite; the Pages build uses the repo path.
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
