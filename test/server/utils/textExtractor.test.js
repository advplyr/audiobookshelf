const { expect } = require('chai')
const sinon = require('sinon')
const Path = require('path')
const os = require('os')
const fs = require('fs')
const { execSync } = require('child_process')

const textExtractor = require('../../../server/utils/textExtractor')

describe('TextExtractor', () => {
  describe('stripHtml', () => {
    it('should strip HTML tags', () => {
      const result = textExtractor.stripHtml('<p>Hello <b>world</b></p>')
      expect(result).to.equal('Hello world')
    })

    it('should remove script tags with content', () => {
      const result = textExtractor.stripHtml('<p>Hello</p><script>alert("x")</script><p>World</p>')
      expect(result).to.equal('Hello World')
    })

    it('should remove style tags with content', () => {
      const result = textExtractor.stripHtml('<style>.foo { color: red; }</style><p>Text</p>')
      expect(result).to.equal('Text')
    })

    it('should decode HTML entities', () => {
      const result = textExtractor.stripHtml('&amp; &lt; &gt; &quot; &#39; &nbsp;')
      expect(result).to.equal("& < > \" '")
    })

    it('should collapse whitespace', () => {
      const result = textExtractor.stripHtml('<p>Hello</p>   <p>World</p>  \n\t  <p>!</p>')
      expect(result).to.equal('Hello World !')
    })

    it('should return empty string for empty input', () => {
      const result = textExtractor.stripHtml('')
      expect(result).to.equal('')
    })
  })

  describe('extractFromEpub', () => {
    let epubPath
    let tmpDir

    /**
     * Creates a minimal valid EPUB file using the system zip command
     */
    function createTestEpub(destPath) {
      tmpDir = fs.mkdtempSync(Path.join(os.tmpdir(), 'epub-test-'))

      // Create directory structure
      fs.mkdirSync(Path.join(tmpDir, 'META-INF'), { recursive: true })
      fs.mkdirSync(Path.join(tmpDir, 'OEBPS'), { recursive: true })

      // mimetype
      fs.writeFileSync(Path.join(tmpDir, 'mimetype'), 'application/epub+zip')

      // container.xml
      fs.writeFileSync(
        Path.join(tmpDir, 'META-INF', 'container.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
      )

      // content.opf
      fs.writeFileSync(
        Path.join(tmpDir, 'OEBPS', 'content.opf'),
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`
      )

      // chapter1.xhtml
      fs.writeFileSync(
        Path.join(tmpDir, 'OEBPS', 'chapter1.xhtml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body><h1>Chapter One</h1><p>This is the first chapter content.</p></body>
</html>`
      )

      // chapter2.xhtml
      fs.writeFileSync(
        Path.join(tmpDir, 'OEBPS', 'chapter2.xhtml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title></head>
<body><h1>Chapter Two</h1><p>This is the second chapter.</p></body>
</html>`
      )

      // Create ZIP (EPUB is a ZIP file)
      // First add mimetype uncompressed, then the rest
      execSync(`cd "${tmpDir}" && zip -0 -X "${destPath}" mimetype && zip -r -X "${destPath}" META-INF OEBPS`)
    }

    before(() => {
      epubPath = Path.join(os.tmpdir(), `test-epub-${Date.now()}.epub`)
      createTestEpub(epubPath)
    })

    after(() => {
      try {
        fs.unlinkSync(epubPath)
      } catch (_) {}
      try {
        fs.rmSync(tmpDir, { recursive: true })
      } catch (_) {}
    })

    it('should extract chapters from a valid EPUB', async () => {
      const chapters = await textExtractor.extractFromEpub(epubPath)

      expect(chapters).to.be.an('array')
      expect(chapters.length).to.equal(2)
      expect(chapters[0].title).to.equal('Chapter 1')
      expect(chapters[0].text).to.include('first chapter content')
      expect(chapters[1].title).to.equal('Chapter 2')
      expect(chapters[1].text).to.include('second chapter')
    })

    it('should throw for non-existent file', async () => {
      try {
        await textExtractor.extractFromEpub('/nonexistent/path/book.epub')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).to.be.an('error')
      }
    })
  })
})
