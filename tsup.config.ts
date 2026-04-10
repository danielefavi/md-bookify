import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bin/md-bookify': 'bin/md-bookify.ts',
  },
  format: ['esm'],
  target: 'node18',
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
  shims: true,
  define: {
    PKG_VERSION: JSON.stringify(version),
  },
});
