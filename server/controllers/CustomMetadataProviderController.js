const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const { validateUrl } = require('../utils/index')

//
// This is a controller for routes that don't have a home yet :(
//
class CustomMetadataProviderController {
  constructor() { }

  /**
   * GET: /api/custom-metadata-providers
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getAll(req, res) {
    const providers = await Database.customMetadataProviderModel.findAll()

    res.json({
      providers
    })
  }

  /**
   * POST: /api/custom-metadata-providers
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async create(req, res) {
    const { name, url, mediaType, authHeaderValue } = req.body

    if (!name || !url || !mediaType) {
      return res.status(400).send('Invalid request body')
    }

    const validUrl = validateUrl(url)
    if (!validUrl) {
      Logger.error(`[CustomMetadataProviderController] Invalid url "${url}"`)
      return res.status(400).send('Invalid url')
    }

    const provider = await Database.customMetadataProviderModel.create({
      name,
      mediaType,
      url,
      authHeaderValue: !authHeaderValue ? null : authHeaderValue,
    })

    // TODO: Necessary to emit to all clients?
    SocketAuthority.emitter('custom_metadata_provider_added', provider.toClientJson())

    res.json({
      provider
    })
  }

  /**
   * DELETE: /api/custom-metadata-providers/:id
   * 
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async delete(req, res) {
    const slug = `custom-${req.params.id}`

    /** @type {import('../models/CustomMetadataProvider')} */
    const provider = req.customMetadataProvider
    const providerClientJson = provider.toClientJson()

    const fallbackProvider = provider.mediaType === 'book' ? 'google' : 'itunes'

    await provider.destroy()

    // Libraries using this provider fallback to default provider
    await Database.libraryModel.update({
      provider: fallbackProvider
    }, {
      where: {
        provider: slug
      }
    })

    // TODO: Necessary to emit to all clients?
    SocketAuthority.emitter('custom_metadata_provider_removed', providerClientJson)

    res.sendStatus(200)
  }

  /**
   * Middleware that requires admin or up
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   * @param {import('express').NextFunction} next 
   */
  async middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      Logger.warn(`[CustomMetadataProviderController] Non-admin user "${req.user.username}" attempted access route "${req.path}"`)
      return res.sendStatus(403)
    }

    // If id param then add req.customMetadataProvider
    if (req.params.id) {
      req.customMetadataProvider = await Database.customMetadataProviderModel.findByPk(req.params.id)
      if (!req.customMetadataProvider) {
        return res.sendStatus(404)
      }
    }

    next()
  }
}
module.exports = new CustomMetadataProviderController()
