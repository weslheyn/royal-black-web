import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project repositories under /<repository-name>/.
// Public site is hosted from the dedicated royal-black-web repository.
export default defineConfig({
  plugins: [react()],
  base: '/royal-black-web/',
});
