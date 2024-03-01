const server = require('./server/Server')
global.appRoot = __dirname

const isDev = process.env.NODE_ENV !== 'production'
if (isDev) {
  const devEnv = require('./dev').config
  process.env.NODE_ENV = 'development'
  if (devEnv.Port) process.env.PORT = devEnv.Port
  if (devEnv.ConfigPath) process.env.CONFIG_PATH = devEnv.ConfigPath
  if (devEnv.MetadataPath) process.env.METADATA_PATH = devEnv.MetadataPath
  if (devEnv.FFmpegPath) process.env.FFMPEG_PATH = devEnv.FFmpegPath
  if (devEnv.FFProbePath) process.env.FFPROBE_PATH = devEnv.FFProbePath
  process.env.SOURCE = 'local'
  process.env.ROUTER_BASE_PATH = devEnv.RouterBasePath || ''
}

const PORT = process.env.PORT || 80
const HOST = process.env.HOST
const CONFIG_PATH = process.env.CONFIG_PATH || '/config'
const METADATA_PATH = process.env.METADATA_PATH || '/metadata'
const UID = process.env.AUDIOBOOKSHELF_UID
const GID = process.env.AUDIOBOOKSHELF_GID
const SOURCE = process.env.SOURCE || 'docker'
const ROUTER_BASE_PATH = process.env.ROUTER_BASE_PATH || ''

console.log('Config', CONFIG_PATH, METADATA_PATH)

const Server = new server(SOURCE, PORT, HOST, UID, GID, CONFIG_PATH, METADATA_PATH, ROUTER_BASE_PATH)
Server.start()
