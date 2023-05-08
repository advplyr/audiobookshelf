const path = require('path')
const url = require('url');

const serverPath = path.resolve(__dirname, 'test.js')
const serverUrl = url.pathToFileURL(serverPath).href

export { serverUrl as 'import.meta.url' }
