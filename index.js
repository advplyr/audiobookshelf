if(process.env.TOKEN_SECRET == null) process.env.TOKEN_SECRET = '09f26e402586e2faa8da4c98a35f1b20d6b033c6097befa8be3486a829587fe2f90a832bd3ff9d42710a4da095a2ce285b009f0c3730cd9b8e1af3eb84df6611'
const server = require('./server/Server')
global.appRoot = __dirname

const isDev = process.env.NODE_ENV !== 'production'
if (isDev) {
  const devEnv = require('./dev').config
  process.env.NODE_ENV = 'development'
  process.env.PORT = devEnv.Port
  process.env.CONFIG_PATH = devEnv.ConfigPath
  process.env.METADATA_PATH = devEnv.MetadataPath
  process.env.AUDIOBOOK_PATH = devEnv.AudiobookPath
  process.env.FFMPEG_PATH = devEnv.FFmpegPath
  process.env.FFPROBE_PATH = devEnv.FFProbePath
}

const PORT = process.env.PORT || 80
const HOST = process.env.HOST || '0.0.0.0'
const CONFIG_PATH = process.env.CONFIG_PATH || '/config'
const AUDIOBOOK_PATH = process.env.AUDIOBOOK_PATH || '/audiobooks'
const METADATA_PATH = process.env.METADATA_PATH || '/metadata'
const UID = process.env.AUDIOBOOKSHELF_UID || 99
const GID = process.env.AUDIOBOOKSHELF_GID || 100

console.log('Config', CONFIG_PATH, METADATA_PATH, AUDIOBOOK_PATH)

const Server = new server(PORT, HOST, UID, GID, CONFIG_PATH, METADATA_PATH, AUDIOBOOK_PATH)
Server.start()
