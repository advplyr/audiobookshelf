import type { Request, Response, NextFunction } from 'express'
import type User from '../models/User'
import type Notification from '../objects/Notification'
import type NotificationSettings from '../objects/settings/NotificationSettings'
import Database from '../Database'
import { version } from '../../package.json'
import NotificationManager from '../managers/NotificationManager'

type RequestWithUser = Request & { user: User }
type RequestWithBody<Body> = Request<Record<string, string>, unknown, Body> & { user: User }
type NotificationContext = { notification: Notification }

class NotificationController {
  constructor() {}

  /**
   * GET: /api/notifications
   * Get notifications, settings and data
   */
  get(_req: RequestWithUser, res: Response) {
    res.json({
      data: NotificationManager.getData(),
      settings: Database.notificationSettings
    })
  }

  /**
   * PATCH: /api/notifications
   */
  async update(req: RequestWithBody<Parameters<NotificationSettings['update']>[0]>, res: Response) {
    const updated = Database.notificationSettings!.update(req.body)
    if (updated) {
      await Database.updateSetting(Database.notificationSettings!)
    }
    res.sendStatus(200)
  }

  /**
   * GET: /api/notificationdata
   * @deprecated Use /api/notifications
   */
  getData(_req: RequestWithUser, res: Response) {
    res.json(NotificationManager.getData())
  }

  /**
   * GET: /api/notifications/test
   */
  async fireTestEvent(req: RequestWithUser, res: Response) {
    await NotificationManager.triggerNotification('onTest', { version: `v${version}` }, req.query.fail === '1')
    res.sendStatus(200)
  }

  /**
   * POST: /api/notifications
   */
  async createNotification(req: RequestWithBody<Parameters<NotificationSettings['createNotification']>[0]>, res: Response) {
    const success = Database.notificationSettings!.createNotification(req.body)

    if (success) {
      await Database.updateSetting(Database.notificationSettings!)
    }
    res.json(Database.notificationSettings)
  }

  /**
   * DELETE: /api/notifications/:id
   */
  async deleteNotification(req: RequestWithUser & NotificationContext, res: Response) {
    if (Database.notificationSettings!.removeNotification(req.notification.id!)) {
      await Database.updateSetting(Database.notificationSettings!)
    }
    res.json(Database.notificationSettings)
  }

  /**
   * PATCH: /api/notifications/:id
   */
  async updateNotification(req: RequestWithBody<Parameters<NotificationSettings['updateNotification']>[0]>, res: Response) {
    const success = Database.notificationSettings!.updateNotification(req.body)
    if (success) {
      await Database.updateSetting(Database.notificationSettings!)
    }
    res.json(Database.notificationSettings)
  }

  /**
   * GET: /api/notifications/:id/test
   */
  async sendNotificationTest(req: RequestWithUser & NotificationContext, res: Response) {
    if (!Database.notificationSettings!.isUseable) return res.status(400).send('Apprise is not configured')

    const success = await NotificationManager.sendTestNotification(req.notification)
    if (success) res.sendStatus(200)
    else res.sendStatus(500)
  }

  /**
   * Requires admin or up
   */
  middleware(req: RequestWithUser & Partial<NotificationContext>, res: Response, next: NextFunction) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }

    if (req.params.id) {
      const notification = Database.notificationSettings!.getNotification(req.params.id)
      if (!notification) {
        return res.sendStatus(404)
      }
      req.notification = notification
    }

    next()
  }
}
export = new NotificationController()
