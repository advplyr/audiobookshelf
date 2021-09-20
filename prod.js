const Path = require('path')
process.env.TOKEN_SECRET = '09f26e402586e2faa8da4c98a35f1b20d6b033c6097befa8be3486a829587fe2f90a832bd3ff9d42710a4da095a2ce285b009f0c3730cd9b8e1af3eb84df6611'
process.env.NODE_ENV = 'production'

const server = require('./server/Server')
global.appRoot = __dirname

const PORT = process.env.PORT || 3333
const CONFIG_PATH = process.env.CONFIG_PATH || Path.resolve('config')
const AUDIOBOOK_PATH = process.env.AUDIOBOOK_PATH || Path.resolve('audiobooks')
const METADATA_PATH = process.env.METADATA_PATH || Path.resolve('metadata')

console.log('Config', CONFIG_PATH, METADATA_PATH, AUDIOBOOK_PATH)

const Server = new server(PORT, CONFIG_PATH, METADATA_PATH, AUDIOBOOK_PATH)
Server.start()
