/**
 * Download the pinned audiobookshelf-client-react runtime archive and extract it.
 *
 * The tag comes from package.json "clientReactRelease" unless CLIENT_REACT_RELEASE is set.
 * CLIENT_REACT_REPOSITORY overrides the GitHub repo (default audiobookshelf/audiobookshelf-client-react).
 *
 * Usage: node scripts/fetch-client-react-runtime.js --out <dest-dir>
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Readable } = require('stream')
const { pipeline } = require('stream/promises')
const { spawnSync } = require('child_process')

const ARCHIVE_NAME = 'audiobookshelf-client-runtime.tar.gz'
const DEFAULT_REPOSITORY = 'audiobookshelf/audiobookshelf-client-react'
const REPOSITORY_PATTERN = /^[\w.-]+\/[\w.-]+$/

function fail(message) {
  const error = new Error(message)
  error.userFacing = true
  throw error
}

function parseArgs(argv) {
  let out = null
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--out') {
      const value = argv[++i]
      if (!value) fail('Missing value for --out')
      out = value
      continue
    }
    fail(`Unknown argument: ${arg}\nUsage: node scripts/fetch-client-react-runtime.js --out <dest-dir>`)
  }
  if (!out) fail('Usage: node scripts/fetch-client-react-runtime.js --out <dest-dir>')
  return path.resolve(out)
}

function readPinnedTag() {
  const fromEnv = process.env.CLIENT_REACT_RELEASE
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()

  const packagePath = path.join(__dirname, '..', 'package.json')
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  } catch (error) {
    fail(`Cannot read ${packagePath}: ${error.message}`)
  }
  const tag = typeof pkg.clientReactRelease === 'string' ? pkg.clientReactRelease.trim() : ''
  if (!tag || /[\s]/.test(tag)) {
    fail(`package.json "clientReactRelease" must be one release tag, for example v0.1.0.`)
  }
  return tag
}

function readRepository() {
  const repository = (process.env.CLIENT_REACT_REPOSITORY || DEFAULT_REPOSITORY).trim()
  if (!REPOSITORY_PATTERN.test(repository)) {
    fail(`CLIENT_REACT_REPOSITORY must be owner/name. Got: ${repository}`)
  }
  return repository
}

function archiveUrl(repository, tag) {
  return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${ARCHIVE_NAME}`
}

async function downloadArchive(url, destination) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'audiobookshelf-fetch-client-runtime' }
  })
  if (!response.ok) {
    fail(`Failed to download ${url} (${response.status} ${response.statusText}). The client release must include ${ARCHIVE_NAME}.`)
  }
  if (!response.body) fail(`Failed to download ${url}: empty response body.`)
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination))
}

function extractArchive(archivePath, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  const result = spawnSync('tar', ['-xzf', archivePath, '-C', outDir, '--strip-components=1'], { stdio: 'inherit' })
  if (result.error) {
    fail(`Failed to run tar: ${result.error.message}. tar is required to extract the client runtime.`)
  }
  if (result.status !== 0) {
    fail(`tar exited with status ${result.status} while extracting ${archivePath}`)
  }
}

function assertRuntime(outDir) {
  const required = ['node_modules/next/package.json', '.next/BUILD_ID', 'next.config.mjs']
  const missing = required.filter((relative) => !fs.existsSync(path.join(outDir, relative)))
  if (missing.length) {
    fail(`Extracted client runtime at ${outDir} is missing:\n${missing.join('\n')}`)
  }
}

async function main() {
  const outDir = parseArgs(process.argv)
  const tag = readPinnedTag()
  const repository = readRepository()
  const url = archiveUrl(repository, tag)
  const archivePath = path.join(os.tmpdir(), `audiobookshelf-client-runtime-${process.pid}.tar.gz`)

  console.log(`Fetching React client ${tag} from ${repository}`)
  console.log(url)
  try {
    await downloadArchive(url, archivePath)
    extractArchive(archivePath, outDir)
    assertRuntime(outDir)
  } finally {
    fs.rmSync(archivePath, { force: true })
  }
  console.log(`React client runtime extracted to ${outDir}`)
}

main().catch((error) => {
  console.error(error && error.userFacing ? error.message : error && error.stack ? error.stack : String(error))
  process.exit(1)
})
