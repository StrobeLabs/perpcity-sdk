import { defineConfig } from 'tsup';

export default defineConfig({
  // One entry per public subpath (package.json "exports"): consumers that
  // only need the abis or a few utils can import the slice without pulling
  // the whole SDK graph into their bundle. Root "." keeps exporting
  // everything, unchanged.
  entry: {
    index: 'src/index.ts',
    abis: 'src/abis/index.ts',
    context: 'src/context.ts',
    functions: 'src/functions/index.ts',
    utils: 'src/utils/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  // Share code between entries as chunks instead of duplicating it per
  // entry (applies to both the ESM and CJS outputs).
  splitting: true,
  sourcemap: true,
  clean: true,
});
