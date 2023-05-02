const Path = require('path')
const { promises: { readFile, writeFile } } = require('fs')
const { glob } = require('glob')

/**
 * Rewrite PWA manifest paths to include router base path
 * @nuxtjs/pwa module does not support a dynamic router base path,
 * so we have to rewrite the manifest paths manually
 * 
 * @see https://github.com/nuxt/nuxt/pull/8520
 * @see https://github.com/nuxt-community/pwa-module/issues/435
 */
export default function rewritePwaManifest () {
  this.nuxt.hook('ready', async ({ options }) => {
    // Do not run on build, this is where the manifest is generated
    if (options._build) return

    const routerBasePath = options.router.base
    const clientDir = Path.join(options.buildDir, 'dist/client')
    let rewritten = false

    // Find manifest file generated to the build directory
    const manifestPaths = await glob('manifest.*.json', { cwd: clientDir })
    if (manifestPaths.length === 0) {
      console.warn(`[PWA] No manifest not found under ${clientDir}/manifest.*.json`)
      return
    }

    // Rewrite manifest paths for all found manifest files
    for (const manifestPath of manifestPaths) {
      const manifestJson = await readFile(Path.join(clientDir, manifestPath), 'utf8')
      const manifest = JSON.parse(manifestJson)

      const currentBasePath = manifest.start_url.split('?')[0]

      if (currentBasePath !== (routerBasePath || '/')) {
        // Rewrite start_url and icons paths
        manifest.start_url = `${routerBasePath}${manifest.start_url.slice(currentBasePath.length)}`
        for (const icon of manifest.icons) {
          const path = icon.src.startsWith('/') ? icon.src.slice(currentBasePath.length) : icon.src
          icon.src = `${routerBasePath}${path}`
        }

        // Update manifest file
        await writeFile(Path.join(clientDir, manifestPath), JSON.stringify(manifest), 'utf8')
        rewritten = true
      }
    }

    if (rewritten) {
      console.info('[PWA] Manifest paths rewritten')
    }
  })
}
