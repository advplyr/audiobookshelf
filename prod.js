const optionDefinitions = [
  { name: 'config', alias: 'c', type: String },
  { name: 'metadata', alias: 'm', type: String },
  { name: 'port', alias: 'p', type: String },
  { name: 'host', alias: 'h', type: String },
  { name: 'source', alias: 's', type: String }
]

const commandLineArgs = require('command-line-args')
const options = commandLineArgs(optionDefinitions)

const Path = require('path')
if (process.env.TOKEN_SECRET == null) process.env.TOKEN_SECRET = '09f26e402586e2faa8da4c98a35f1b20d6b033c6097befa8be3486a829587fe2f90a832bd3ff9d42710a4da095a2ce285b009f0c3730cd9b8e1af3eb84df6611'
process.env.NODE_ENV = 'production'

const server = require('./server/Server')

global.appRoot = __dirname

var inputConfig = options.config ? Path.resolve(options.config) : null
var inputMetadata = options.metadata ? Path.resolve(options.metadata) : null

const PORT = options.port || process.env.PORT || 3333
const HOST = options.host || process.env.HOST || "0.0.0.0"
const CONFIG_PATH = inputConfig || process.env.CONFIG_PATH || Path.resolve('config')
const METADATA_PATH = inputMetadata || process.env.METADATA_PATH || Path.resolve('metadata')
const UID = 99
const GID = 100
const SOURCE = options.source || 'debian'

console.log(process.env.NODE_ENV, 'Config', CONFIG_PATH, METADATA_PATH)

const Server = new server(SOURCE, PORT, HOST, UID, GID, CONFIG_PATH, METADATA_PATH)
Server.start()
