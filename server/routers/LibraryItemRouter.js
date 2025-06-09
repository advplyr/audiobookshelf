const express = require('express')
const router = express.Router()

// Get library item by id
router.get('/:id', async (req, res) => {
  const libraryItem = await req.ctx.models.libraryItem.getExpandedById(req.params.id)
  if (!libraryItem) {
    return res.status(404).send({ error: 'Library item not found' })
  }
  res.json(libraryItem.toOldJSONExpanded())
})

// Get comments for a library item
router.get('/:id/comments', async (req, res) => {
  const libraryItem = await req.ctx.models.libraryItem.findByPk(req.params.id)
  if (!libraryItem) {
    return res.status(404).send({ error: 'Library item not found' })
  }

  const comments = await req.ctx.models.comment.findAll({
    where: { libraryItemId: req.params.id },
    include: [{
      model: req.ctx.models.user,
      as: 'user',
      attributes: ['id', 'username']
    }],
    order: [['createdAt', 'DESC']]
  })

  res.json(comments)
})

// Add a comment to a library item
router.post('/:id/comments', async (req, res) => {
  const libraryItem = await req.ctx.models.libraryItem.findByPk(req.params.id)
  if (!libraryItem) {
    return res.status(404).send({ error: 'Library item not found' })
  }

  const comment = await req.ctx.models.comment.create({
    text: req.body.text,
    libraryItemId: req.params.id,
    userId: req.user.id
  })

  const commentWithUser = await req.ctx.models.comment.findByPk(comment.id, {
    include: [{
      model: req.ctx.models.user,
      as: 'user',
      attributes: ['id', 'username']
    }]
  })

  res.json(commentWithUser)
})

// Update a comment
router.patch('/:itemId/comments/:commentId', async (req, res) => {
  const comment = await req.ctx.models.comment.findByPk(req.params.commentId)
  if (!comment) {
    return res.status(404).send({ error: 'Comment not found' })
  }

  if (comment.userId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).send({ error: 'Not authorized to update this comment' })
  }

  await comment.update({
    text: req.body.text
  })

  const updatedComment = await req.ctx.models.comment.findByPk(comment.id, {
    include: [{
      model: req.ctx.models.user,
      as: 'user',
      attributes: ['id', 'username']
    }]
  })

  res.json(updatedComment)
})

// Delete a comment
router.delete('/:itemId/comments/:commentId', async (req, res) => {
  const comment = await req.ctx.models.comment.findByPk(req.params.commentId)
  if (!comment) {
    return res.status(404).send({ error: 'Comment not found' })
  }

  if (comment.userId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).send({ error: 'Not authorized to delete this comment' })
  }

  await comment.destroy()
  res.json({ success: true })
})

module.exports = router 