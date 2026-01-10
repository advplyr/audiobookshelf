const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' })
const { version } = require('./package.json')

const doc = {
  info: {
    version: version,
    title: 'Audiobookshelf API',
    description: 'Self-hosted audiobook and podcast server API'
  },
  servers: [
    {
      url: 'http://localhost:3333',
      description: 'Local development server'
    }
  ],
  tags: [
    { name: 'Libraries', description: 'Library management endpoints' },
    { name: 'Library Items', description: 'Library item management endpoints' },
    { name: 'Users', description: 'User management endpoints' },
    { name: 'Collections', description: 'Collection management endpoints' },
    { name: 'Playlists', description: 'Playlist management endpoints' },
    { name: 'Me', description: 'Current user endpoints' },
    { name: 'Backups', description: 'Backup management endpoints' },
    { name: 'Series', description: 'Series management endpoints' },
    { name: 'Authors', description: 'Author management endpoints' },
    { name: 'Sessions', description: 'Playback session endpoints' },
    { name: 'Podcasts', description: 'Podcast management endpoints' },
    { name: 'Notifications', description: 'Notification management endpoints' },
    { name: 'Email', description: 'Email configuration endpoints' },
    { name: 'Search', description: 'Search endpoints' },
    { name: 'Cache', description: 'Cache management endpoints' },
    { name: 'Tools', description: 'Tool endpoints' },
    { name: 'RSS Feeds', description: 'RSS feed management endpoints' },
    { name: 'Custom Metadata Providers', description: 'Custom metadata provider endpoints' },
    { name: 'Misc', description: 'Miscellaneous endpoints' },
    { name: 'Share', description: 'Media sharing endpoints' },
    { name: 'Stats', description: 'Statistics endpoints' },
    { name: 'API Keys', description: 'API key management endpoints' },
    { name: 'File System', description: 'File system endpoints' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Authorization header using the Bearer scheme'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
        description: 'Session cookie authentication'
      }
    }
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }]
}

const outputFile = './docs/swagger-output.json'
const routes = ['./server/routers/ApiRouter.js']

swaggerAutogen(outputFile, routes, doc).then((data) => {
  const spec = data.data
  const fs = require('fs')

  const tagMap = {
    libraries: ['Libraries', /\/libraries/i],
    items: ['Library Items', /\/items/i],
    users: ['Users', /\/users/i],
    collections: ['Collections', /\/collections/i],
    playlists: ['Playlists', /\/playlists/i],
    me: ['Me', /\/me/i],
    backups: ['Backups', /\/backups/i],
    series: ['Series', /\/series/i],
    authors: ['Authors', /\/authors/i],
    sessions: ['Sessions', /\/sessions|\/session/i],
    podcasts: ['Podcasts', /\/podcasts/i],
    notifications: ['Notifications', /\/notifications/i],
    email: ['Email', /\/emails/i],
    search: ['Search', /\/search/i],
    cache: ['Cache', /\/cache/i],
    tools: ['Tools', /\/tools/i],
    feeds: ['RSS Feeds', /\/feeds/i],
    metadata: ['Custom Metadata Providers', /\/custom-metadata-providers/i],
    share: ['Share', /\/share/i],
    stats: ['Stats', /\/stats/i],
    apikeys: ['API Keys', /\/api-keys/i],
    filesystem: ['File System', /\/filesystem/i],
    misc: ['Misc', /.*/]
  }

  for (const path in spec.paths) {
    const pathSpec = spec.paths[path]

    for (const method in pathSpec) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        const operation = pathSpec[method]

        for (const key in tagMap) {
          const [tagName, pattern] = tagMap[key]
          if (pattern.test(path)) {
            if (!operation.tags) operation.tags = []
            if (!operation.tags.includes(tagName)) {
              operation.tags = [tagName]
            }
            break
          }
        }
      }
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2))

  console.log('Swagger documentation generated successfully!')
  console.log(`Generated ${Object.keys(spec.paths).length} endpoints`)
})
