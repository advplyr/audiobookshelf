#!/usr/bin/env node
/**
 * View Swagger documentation in browser
 * Opens ReDoc documentation for the generated swagger-output.json
 */

const http = require('http')
const fs = require('fs')
const path = require('path')

const swaggerPath = path.join(__dirname, 'docs', 'swagger-output.json')
const port = 3004

if (!fs.existsSync(swaggerPath)) {
  console.error('swagger-output.json not found. Run "node swagger.js" first.')
  process.exit(1)
}

const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Audiobookshelf API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <redoc spec-url='/swagger.json'></redoc>
  <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"> </script>
</body>
</html>
`

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  } else if (req.url === '/swagger.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(fs.readFileSync(swaggerPath))
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(port, () => {
  console.log(`ReDoc API documentation: http://localhost:${port}`)
})
