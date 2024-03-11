const optionDefinitions = [
  { name: 'config', alias: 'c', type: String },
  { name: 'metadata', alias: 'm', type: String },
  { name: 'port', alias: 'p', type: String },
  { name: 'host', alias: 'h', type: String },
  { name: 'source', alias: 's', type: String }
]

const commandLineArgs = require('./server/libs/commandLineArgs')
const options = commandLineArgs(optionDefinitions)

const Path = require('path')
process.env.NODE_ENV = 'production'

const server = require('./server/Server')

global.appRoot = __dirname

var inputConfig = options.config ? Path.resolve(options.config) : null
var inputMetadata = options.metadata ? Path.resolve(options.metadata) : null

const PORT = options.port || process.env.PORT || 3333
const HOST = options.host || process.env.HOST
const CONFIG_PATH = inputConfig || process.env.CONFIG_PATH || Path.resolve('config')
const METADATA_PATH = inputMetadata || process.env.METADATA_PATH || Path.resolve('metadata')
const SOURCE = options.source || process.env.SOURCE || 'debian'

const ROUTER_BASE_PATH = process.env.ROUTER_BASE_PATH || ''

console.log(process.env.NODE_ENV, 'Config', CONFIG_PATH, METADATA_PATH)

const Server = new server(SOURCE, PORT, HOST, CONFIG_PATH, METADATA_PATH, ROUTER_BASE_PATH)
Server.start()
