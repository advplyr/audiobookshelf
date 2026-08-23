const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const outputDirectory = path.join(projectRoot, 'dist-server')

fs.rmSync(outputDirectory, { recursive: true, force: true })
fs.mkdirSync(outputDirectory, { recursive: true })
fs.copyFileSync(path.join(projectRoot, 'package.json'), path.join(outputDirectory, 'package.json'))
fs.copyFileSync(path.join(projectRoot, 'index.js'), path.join(outputDirectory, 'index.js'))

const devConfigPath = path.join(projectRoot, 'dev.js')
if (fs.existsSync(devConfigPath)) {
  fs.copyFileSync(devConfigPath, path.join(outputDirectory, 'dev.js'))
}

fs.cpSync(path.join(projectRoot, 'server'), path.join(outputDirectory, 'server'), {
  recursive: true,
  force: true
})

const testDirectory = path.join(projectRoot, 'test')
if (fs.existsSync(testDirectory)) {
  fs.cpSync(testDirectory, path.join(outputDirectory, 'test'), {
    recursive: true,
    force: true
  })
}

function hasTypeScriptSource(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory() && hasTypeScriptSource(entryPath)) return true
    if (entry.isFile() && entry.name.endsWith('.ts')) return true
  }
  return false
}

if (hasTypeScriptSource(path.join(projectRoot, 'server'))) {
  const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.server.json'], {
    cwd: projectRoot,
    stdio: 'inherit'
  })
  process.exit(result.status || 0)
}
