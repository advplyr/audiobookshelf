const Database = require('../Database')
const Logger = require('../Logger')

class ReviewController {
  constructor() {}

  /**
   * POST: /api/items/:id/review
   * Create or update the current user's review for a library item.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async createUpdate(req, res) {
    const { rating, reviewText } = req.body
    const libraryItemId = req.params.id

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).send('Invalid rating. Must be an integer between 1 and 5.')
    }

    const cleanReviewText = reviewText ? String(reviewText).trim().substring(0, 5000) : null

    try {
      const [review, created] = await Database.reviewModel.findOrCreate({
        where: {
          userId: req.user.id,
          libraryItemId
        },
        defaults: {
          rating,
          reviewText: cleanReviewText
        }
      })

      if (!created) {
        review.rating = rating
        review.reviewText = cleanReviewText
        await review.save()
      }

      // Load user for toOldJSON
      review.user = req.user

      res.json(review.toOldJSON())
    } catch (error) {
      Logger.error(`[ReviewController] Failed to create/update review`, error)
      res.status(500).send('Failed to save review')
    }
  }

  /**
   * GET: /api/items/:id/reviews
   * Get all reviews for a library item.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async findAllForItem(req, res) {
    const libraryItemId = req.params.id

    try {
      const reviews = await Database.reviewModel.findAll({
        where: { libraryItemId },
        include: [
          {
            model: Database.userModel,
            attributes: ['id', 'username']
          }
        ],
        order: [['createdAt', 'DESC']]
      })

      res.json(reviews.map((r) => r.toOldJSON()))
    } catch (error) {
      Logger.error(`[ReviewController] Failed to fetch reviews for item ${libraryItemId}`, error)
      res.status(500).send('Failed to fetch reviews')
    }
  }

  /**
   * DELETE: /api/items/:id/review
   * Delete the current user's review for a library item.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async delete(req, res) {
    const libraryItemId = req.params.id

    try {
      const review = await Database.reviewModel.findOne({
        where: {
          userId: req.user.id,
          libraryItemId
        }
      })

      if (!review) {
        return res.sendStatus(404)
      }

      await review.destroy()
      res.sendStatus(200)
    } catch (error) {
      Logger.error(`[ReviewController] Failed to delete review for item ${libraryItemId}`, error)
      res.status(500).send('Failed to delete review')
    }
  }

  /**
   * GET: /api/me/reviews
   * Get all reviews by the current user.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async findAllForUser(req, res) {
    try {
      const reviews = await Database.reviewModel.findAll({
        where: { userId: req.user.id },
        include: [
          {
            model: Database.libraryItemModel,
            include: [
              {
                model: Database.bookModel
              },
              {
                model: Database.podcastModel
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      })

      res.json(reviews.map((r) => {
        const json = r.toOldJSON()
        if (r.libraryItem) {
          json.libraryItem = r.libraryItem.toOldJSONMinified()
        }
        return json
      }))
    } catch (error) {
      Logger.error(`[ReviewController] Failed to fetch reviews for user ${req.user.id}`, error)
      res.status(500).send('Failed to fetch reviews')
    }
  }

  /**
   * Middleware for review routes.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async middleware(req, res, next) {
    // Basic library item access check
    req.libraryItem = await Database.libraryItemModel.getExpandedById(req.params.id)
    if (!req.libraryItem?.media) return res.sendStatus(404)

    if (!req.user.checkCanAccessLibraryItem(req.libraryItem)) {
      return res.sendStatus(403)
    }

    next()
  }
}

module.exports = new ReviewController()
