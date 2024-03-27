/**
 * @openapi
 * components:
 *   schemas:
 *     addedAt:
 *       type: integer
 *       description: The time (in ms since POSIX epoch) when added to the server.
 *       example: 1633522963509
 *     createdAt:
 *       type: integer
 *       description: The time (in ms since POSIX epoch) when was created.
 *       example: 1633522963509
 *     updatedAt:
 *       type: integer
 *       description: The time (in ms since POSIX epoch) when last updated.
 *       example: 1633522963509
 *     tags:
 *       description: Tags applied to items.
 *       type: array
 *       items:
 *         type: string
 *       examples:
 *         - Favorite
 *         - Nonfiction/History
 *         - Content: Violence
 */