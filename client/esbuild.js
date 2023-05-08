const { build } = require('esbuild')

build({
  entryPoints: ['.output/server/index.mjs'],
  outfile: '.output/server/index.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  ignoreAnnotations: true,
  sourcemap: true,
  inject: ['./esm-shims.js']
}).then(() => {
  console.info('✔ Server compiled to commonjs target at .output/server/index.js')
}).catch(() => {
  console.error('✘ Server failed to compile')
  process.exit(1)
})
