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
const UID = process.env.AUDIOBOOKSHELF_UID || 99
const GID = process.env.AUDIOBOOKSHELF_GID || 100

const LDAP_URL = process.env.LDAP_URL
const LDAP_BASE_DN = process.env.LDAP_BASE_DN
const LDAP_BIND_USER = process.env.LDAP_BIND_USER
const LDAP_BIND_PASS = process.env.LDAP_BIND_PASS
const LDAP_SEARCH_FILTER = process.env.LDAP_SEARCH_FILTER
const LDAP_USERNAME_ATTRIBUTE = process.env.LDAP_USERNAME_ATTRIBUTE
const LDAP_ENABLED = process.env.LDAP_ENABLED
const SOURCE = process.env.SOURCE || 'docker'
const ROUTER_BASE_PATH = process.env.ROUTER_BASE_PATH || ''

console.log('Config', CONFIG_PATH, METADATA_PATH)

const Server = new server(SOURCE, PORT, HOST, UID, GID, CONFIG_PATH, METADATA_PATH, ROUTER_BASE_PATH, LDAP_ENABLED, LDAP_URL, LDAP_BASE_DN, LDAP_BIND_USER, LDAP_BIND_PASS, LDAP_SEARCH_FILTER, LDAP_USERNAME_ATTRIBUTE)
Server.start()
