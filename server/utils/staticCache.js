const Path = require('path')

// Content-hashed client bundles change name on every build, so they never need revalidating
const HashedNuxtAsset = /(^|\.)[0-9a-f]{7,}\./

/**
 * @param {string} distPath
 * @returns {(res: import('express').Response, path: string) => void}
 */
module.exports.setStaticHeaders = (distPath) => {
  const nuxtPath = Path.join(distPath, '_nuxt') + Path.sep
  return (res, path) => {
    if (path.startsWith(nuxtPath) && HashedNuxtAsset.test(Path.basename(path))) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
  }
}
