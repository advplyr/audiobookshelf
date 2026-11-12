import Path from 'path'
import commandLineArgs from './server/libs/commandLineArgs'

const optionDefinitions = [
  { name: 'config', alias: 'c', type: String },
  { name: 'metadata', alias: 'm', type: String },
  { name: 'port', alias: 'p', type: String },
  { name: 'host', alias: 'h', type: String },
  { name: 'source', alias: 's', type: String }
] as const

const options = commandLineArgs(optionDefinitions)

process.env.NODE_ENV = 'production'

// Logger reads NODE_ENV when Server is loaded.
import Server from './server/Server'

global.appRoot = Path.basename(__dirname) === 'dist-server' ? Path.resolve(__dirname, '..') : __dirname

const inputConfig = options.config ? Path.resolve(options.config) : null
const inputMetadata = options.metadata ? Path.resolve(options.metadata) : null

const PORT = options.port || process.env.PORT || 3333
const HOST = options.host || process.env.HOST
const CONFIG_PATH = inputConfig || process.env.CONFIG_PATH || Path.resolve('config')
const METADATA_PATH = inputMetadata || process.env.METADATA_PATH || Path.resolve('metadata')
const SOURCE = options.source || process.env.SOURCE || 'debian'

const ROUTER_BASE_PATH = process.env.ROUTER_BASE_PATH ?? '/audiobookshelf'

console.log(process.env.NODE_ENV, 'Config', CONFIG_PATH, METADATA_PATH)

const server = new Server(SOURCE, PORT, HOST, CONFIG_PATH, METADATA_PATH, ROUTER_BASE_PATH)
void server.start()
