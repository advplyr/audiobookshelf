import type { Request, Response, NextFunction } from 'express'
import type User from '../models/User'
import type Book from '../models/Book'
import type EmailManager from '../managers/EmailManager'
import type EmailSettings from '../objects/settings/EmailSettings'
import Logger from '../Logger'
import SocketAuthority from '../SocketAuthority'
import Database from '../Database'

type RequestWithUser = Request & { user: User }
type RequestWithBody<Body> = Request<Record<string, string>, unknown, Body> & { user: User }
type EReaderDevice = Parameters<EmailSettings['checkUserCanAccessDevice']>[0]
type EmailContext = { emailManager: EmailManager }

class EmailController {
  constructor() {}

  /**
   * GET: /api/emails/settings
   */
  getSettings(_req: RequestWithUser, res: Response) {
    res.json({
      settings: Database.emailSettings
    })
  }

  /**
   * PATCH: /api/emails/settings
   */
  async updateSettings(req: RequestWithBody<Parameters<EmailSettings['update']>[0]>, res: Response) {
    const updated = Database.emailSettings!.update(req.body)
    if (updated) {
      await Database.updateSetting(Database.emailSettings!)
    }
    res.json({
      settings: Database.emailSettings
    })
  }

  /**
   * POST: /api/emails/test
   */
  async sendTest(this: EmailContext, _req: RequestWithUser, res: Response) {
    void this.emailManager.sendTest(res)
    return Promise.resolve()
  }

  /**
   * POST: /api/emails/ereader-devices
   */
  async updateEReaderDevices(req: RequestWithBody<{ ereaderDevices?: EReaderDevice[] }>, res: Response) {
    if (!req.body.ereaderDevices || !Array.isArray(req.body.ereaderDevices)) {
      return res.status(400).send('Invalid payload. ereaderDevices array required')
    }

    const ereaderDevices = req.body.ereaderDevices
    for (const device of ereaderDevices) {
      if (!device.name || !device.email) {
        return res.status(400).send('Invalid payload. ereaderDevices array items must have name and email')
      }
    }

    const updated = Database.emailSettings!.update({
      ereaderDevices
    })
    if (updated) {
      await Database.updateSetting(Database.emailSettings!)
      SocketAuthority.adminEmitter('ereader-devices-updated', {
        ereaderDevices: Database.emailSettings!.ereaderDevices
      })
    }
    res.json({
      ereaderDevices: Database.emailSettings!.ereaderDevices
    })
  }

  /**
   * POST: /api/emails/send-ebook-to-device
   * Send ebook to device
   * User must have access to device and library item
   */
  async sendEBookToDevice(this: EmailContext, req: RequestWithBody<{ libraryItemId: string; deviceName: string }>, res: Response) {
    Logger.debug(`[EmailController] Send ebook to device requested by user "${req.user.username}" for libraryItemId=${req.body.libraryItemId}, deviceName=${req.body.deviceName}`)

    const device = Database.emailSettings!.getEReaderDevice(req.body.deviceName)
    if (!device) {
      return res.status(404).send('Ereader device not found')
    }

    // Check user has access to device
    if (!Database.emailSettings!.checkUserCanAccessDevice(device, req.user)) {
      return res.sendStatus(403)
    }

    const libraryItem = await Database.libraryItemModel.getExpandedById(req.body.libraryItemId)
    if (!libraryItem) {
      return res.status(404).send('Library item not found')
    }

    // Check user has access to library item
    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      return res.sendStatus(403)
    }

    const ebookFile = (libraryItem.media as Book).ebookFile
    if (!ebookFile) {
      return res.status(404).send('Ebook file not found')
    }

    void this.emailManager.sendEBookToDevice(ebookFile, device, res)
  }

  adminMiddleware(req: RequestWithUser, res: Response, next: NextFunction) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(404)
    }

    next()
  }
}
export = new EmailController()
