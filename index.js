const optionDefinitions = [
  { name: 'config', alias: 'c', type: String },
  { name: 'metadata', alias: 'm', type: String },
  { name: 'port', alias: 'p', type: String },
  { name: 'host', alias: 'h', type: String },
  { name: 'source', alias: 's', type: String },
  { name: 'dev', alias: 'd', type: Boolean },
  // Run in production mode and use dev.js config
  { name: 'prod-with-dev-env', alias: 'r', type: Boolean }
]

const commandLineArgs = require('./server/libs/commandLineArgs')
const options = commandLineArgs(optionDefinitions)

const Path = require('path')
process.env.NODE_ENV = options.dev ? 'development' : process.env.NODE_ENV || 'production'

const server = require('./server/Server')
global.appRoot = __dirname

const isDev = process.env.NODE_ENV !== 'production'
if (isDev || options['prod-with-dev-env']) {
  const devEnv = require('./dev').config
  if (devEnv.Port) process.env.PORT = devEnv.Port
  if (devEnv.ConfigPath) process.env.CONFIG_PATH = devEnv.ConfigPath
  if (devEnv.MetadataPath) process.env.METADATA_PATH = devEnv.MetadataPath
  if (devEnv.FFmpegPath) process.env.FFMPEG_PATH = devEnv.FFmpegPath
  if (devEnv.FFProbePath) process.env.FFPROBE_PATH = devEnv.FFProbePath
  if (devEnv.NunicodePath) process.env.NUSQLITE3_PATH = devEnv.NunicodePath
  if (devEnv.SkipBinariesCheck) process.env.SKIP_BINARIES_CHECK = '1'
  if (devEnv.AllowIframe) process.env.ALLOW_IFRAME = '1'
  if (devEnv.BackupPath) process.env.BACKUP_PATH = devEnv.BackupPath
  if (devEnv.ReactClientPath) process.env.REACT_CLIENT_PATH = devEnv.ReactClientPath
  process.env.SOURCE = 'local'
  process.env.ROUTER_BASE_PATH = devEnv.RouterBasePath ?? '/audiobookshelf'
}

const inputConfig = options.config ? Path.resolve(options.config) : null
const inputMetadata = options.metadata ? Path.resolve(options.metadata) : null

const PORT = options.port || process.env.PORT || 3333
const HOST = options.host || process.env.HOST
const CONFIG_PATH = inputConfig || process.env.CONFIG_PATH || Path.resolve('config')
const METADATA_PATH = inputMetadata || process.env.METADATA_PATH || Path.resolve('metadata')
const SOURCE = options.source || process.env.SOURCE || 'debian'

const ROUTER_BASE_PATH = process.env.ROUTER_BASE_PATH ?? '/audiobookshelf'

console.log(`Running in ${process.env.NODE_ENV} mode.`)
console.log(`Options: CONFIG_PATH=${CONFIG_PATH}, METADATA_PATH=${METADATA_PATH}, PORT=${PORT}, HOST=${HOST}, SOURCE=${SOURCE}, ROUTER_BASE_PATH=${ROUTER_BASE_PATH}`)

const Server = new server(SOURCE, PORT, HOST, CONFIG_PATH, METADATA_PATH, ROUTER_BASE_PATH)
Server.start()
