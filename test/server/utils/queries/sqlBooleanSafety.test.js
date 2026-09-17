const { expect } = require('chai')
const fs = require('fs')
const path = require('path')

function getJsFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) return getJsFiles(entryPath)
    if (entry.isFile() && entry.name.endsWith('.js')) return [entryPath]
    return []
  })
}

describe('query boolean safety', () => {
  it('should not use numeric literals for SQL boolean fields in query code', () => {
    const queriesDir = path.resolve(__dirname, '../../../../server/utils/queries')
    const files = getJsFiles(queriesDir)
    const offenders = []
    const forbiddenPatterns = [
      {
        regex: /\$mediaProgresses\.isFinished\$[\s\S]{0,120}\[null,\s*[01]\]/g,
        message: 'numeric literal in mediaProgresses.isFinished filter'
      },
      {
        regex: /\$books\.mediaProgresses\.isFinished\$[\s\S]{0,120}\[null,\s*[01]\]/g,
        message: 'numeric literal in books.mediaProgresses.isFinished filter'
      },
      {
        regex: /\b(?:mp|mediaProgresses|b)\.(?:isFinished|explicit|abridged)\s*=\s*[01]\b/g,
        message: 'direct SQL boolean comparison against 0/1'
      }
    ]

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8')
      forbiddenPatterns.forEach(({ regex, message }) => {
        const matches = [...content.matchAll(regex)]
        matches.forEach((match) => {
          offenders.push(`${path.relative(queriesDir, filePath)}: ${message}: ${match[0].replace(/\s+/g, ' ').trim()}`)
        })
      })
    })

    expect(offenders).to.deep.equal([])
  })
})
