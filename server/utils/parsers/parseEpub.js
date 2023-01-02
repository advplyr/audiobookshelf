
const Path = require('path')
const h = require('htmlparser2')
const ds = require('dom-serializer')

const Logger = require('../../Logger')
const StreamZip = require('../../libs/nodeStreamZip')
const css = require('../../libs/css')

const { xmlToJSON } = require('../index.js')

module.exports.parse = async (ebookFile, libraryItemId, token, isDev) => {
  const zip = new StreamZip.async({ file: ebookFile.metadata.path })
  const containerXml = await zip.entryData('META-INF/container.xml')
  const containerJson = await xmlToJSON(containerXml.toString('utf8'))

  const packageOpfPath = containerJson.container.rootfiles[0].rootfile[0].$['full-path']
  const packageOpfDir = Path.dirname(packageOpfPath)

  const packageDoc = await zip.entryData(packageOpfPath)
  const packageJson = await xmlToJSON(packageDoc.toString('utf8'))

  const pages = []

  let manifestItems = packageJson.package.manifest[0].item.map(item => item.$)
  const spineItems = packageJson.package.spine[0].itemref.map(ref => ref.$.idref)
  for (const spineItem of spineItems) {
    const mi = manifestItems.find(i => i.id === spineItem)
    if (mi) {
      manifestItems = manifestItems.filter(_mi => _mi.id !== mi.id) // Remove from manifest items

      mi.path = Path.posix.join(packageOpfDir, mi.href)
      pages.push(mi)
    } else {
      Logger.error('[parseEpub] Invalid spine item', spineItem)
    }
  }

  const stylesheets = []
  const resources = []

  for (const manifestItem of manifestItems) {
    manifestItem.path = Path.posix.join(packageOpfDir, manifestItem.href)

    if (manifestItem['media-type'] === 'text/css') {
      const stylesheetData = await zip.entryData(manifestItem.path)
      const modifiedCss = this.parseStylesheet(stylesheetData.toString('utf8'), manifestItem.path, libraryItemId, token, isDev)
      if (modifiedCss) {
        manifestItem.style = modifiedCss
        stylesheets.push(manifestItem)
      } else {
        Logger.error(`[parseEpub] Invalid stylesheet "${manifestItem.path}"`)
      }
    } else {
      resources.push(manifestItem)
    }
  }

  await zip.close()

  return {
    filepath: ebookFile.metadata.path,
    epubVersion: packageJson.package.$.version,
    packageDir: packageOpfDir,
    resources,
    stylesheets,
    pages
  }
}

module.exports.parsePage = async (pagePath, bookData, libraryItemId, token, isDev) => {
  const pageDir = Path.dirname(pagePath)

  const zip = new StreamZip.async({ file: bookData.filepath })
  const pageData = await zip.entryData(pagePath)
  await zip.close()
  const rawHtml = pageData.toString('utf8')

  const results = {}

  const dh = new h.DomHandler((err, dom) => {
    if (err) return results.error = err

    // Get stylesheets
    const isStylesheetLink = (elem) => elem.type == 'tag' && elem.name.toLowerCase() === 'link' && elem.attribs.rel === 'stylesheet' && elem.attribs.type === 'text/css'
    const stylesheets = h.DomUtils.findAll(isStylesheetLink, dom)

    // Get body tag
    const isBodyTag = (elem) => elem.type == 'tag' && elem.name.toLowerCase() == 'body'
    const body = h.DomUtils.findOne(isBodyTag, dom)

    // Get all svg elements
    const isSvgTag = (name) => ['svg'].includes((name || '').toLowerCase())
    const svgElements = h.DomUtils.getElementsByTagName(isSvgTag, body.children)
    svgElements.forEach((el) => {
      if (el.attribs.class) el.attribs.class += ' abs-svg-scale'
      else el.attribs.class = 'abs-svg-scale'
    })

    // Get all img elements
    const isImageTag = (name) => ['img', 'image'].includes((name || '').toLowerCase())
    const imgElements = h.DomUtils.getElementsByTagName(isImageTag, body.children)

    imgElements.forEach(el => {
      if (!el.attribs.src && !el.attribs['xlink:href']) {
        Logger.warn('[parseEpub] parsePage: Invalid img element attribs', el.attribs)
        return
      }

      if (el.attribs.class) el.attribs.class += ' abs-image-scale'
      else el.attribs.class = 'abs-image-scale'

      const srcKey = el.attribs.src ? 'src' : 'xlink:href'
      const src = encodeURIComponent(Path.posix.join(pageDir, el.attribs[srcKey]))

      const basePath = isDev ? 'http://localhost:3333' : ''
      el.attribs[srcKey] = `${basePath}/api/ebooks/${libraryItemId}/resource?path=${src}&token=${token}`
    })

    let finalHtml = '<div class="abs-page-content" style="max-height: unset; margin-left: 15% !important; margin-right: 15% !important;">'

    stylesheets.forEach((el) => {
      const href = Path.posix.join(pageDir, el.attribs.href)
      const ssObj = bookData.stylesheets.find(sso => sso.path === href)

      // find @import css and add it
      const importSheets = getStylesheetImports(ssObj.style, bookData.stylesheets)
      if (importSheets) {
        importSheets.forEach((sheet) => {
          finalHtml += `<style>${sheet.style}</style>\n`
        })
      }

      if (!ssObj) {
        Logger.warn('[parseEpub] parsePage: Stylesheet object not found for href', href)
      } else {
        finalHtml += `<style>${ssObj.style}</style>\n`
      }
    })

    finalHtml += `<style>
.abs-image-scale { max-width: 100%; object-fit: contain; object-position: top center; max-height: 100vh; }
.abs-svg-scale { width: auto; max-height: 80vh; }
</style>\n`

    finalHtml += ds.render(body.children)

    finalHtml += '\n</div>'

    results.html = finalHtml
  })

  const parser = new h.Parser(dh)
  parser.write(rawHtml)
  parser.end()

  return results
}

module.exports.parseStylesheet = (rawCss, stylesheetPath, libraryItemId, token, isDev) => {
  try {
    const stylesheetDir = Path.dirname(stylesheetPath)

    const res = css.parse(rawCss)

    res.stylesheet.rules.forEach((rule) => {
      if (rule.type === 'rule') {
        rule.selectors = rule.selectors.map(s => s === 'body' ? '.abs-page-content' : `.abs-page-content ${s}`)
      } else if (rule.type === 'font-face' && rule.declarations) {
        rule.declarations = rule.declarations.map(dec => {
          if (dec.property === 'src') {
            const match = dec.value.trim().split(' ').shift().match(/url\((.+)\)/)
            if (match && match[1]) {
              const fontPath = Path.posix.join(stylesheetDir, match[1])
              const newSrc = encodeURIComponent(fontPath)

              const basePath = isDev ? 'http://localhost:3333' : ''
              dec.value = dec.value.replace(match[1], `"${basePath}/api/ebooks/${libraryItemId}/resource?path=${newSrc}&token=${token}"`)
            }
          }
          return dec
        })
      } else if (rule.type === 'import') {
        const importUrl = rule.import
        const match = importUrl.match(/\"(.*)\"/)
        const path = match ? match[1] || '' : ''
        if (path) {
          // const newSrc = encodeURIComponent(Path.posix.join(stylesheetDir, path))
          // const basePath = isDev ? 'http://localhost:3333' : ''
          // const newPath = `"${basePath}/api/ebooks/${libraryItemId}/resource?path=${newSrc}&token=${token}"`
          // rule.import = rule.import.replace(path, newPath)

          rule.import = Path.posix.join(stylesheetDir, path)
        }
      }
    })

    return css.stringify(res)
  } catch (error) {
    Logger.error('[parseEpub] parseStylesheet: Failed', error)
    return null
  }
}

function getStylesheetImports(rawCss, stylesheets) {
  try {
    const res = css.parse(rawCss)

    const imports = []
    res.stylesheet.rules.forEach((rule) => {
      if (rule.type === 'import') {
        const importUrl = rule.import.replaceAll('"', '')
        const sheet = stylesheets.find(s => s.path === importUrl)
        if (sheet) imports.push(sheet)
        else {
          Logger.error('[parseEpub] getStylesheetImports: Sheet not found', stylesheets)
        }
      }
    })

    return imports
  } catch (error) {
    Logger.error('[parseEpub] getStylesheetImports: Failed', error)
    return null
  }
}