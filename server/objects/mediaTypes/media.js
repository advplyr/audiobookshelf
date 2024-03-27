/**
 * @openapi
 * components:
 *   schemas:
 *     mediaType:
 *       type: string
 *       description: The type of media, will be book or podcast.
 *       enum: [book, podcast]
 *     media:
 *       description: The media of the library item.
 *       oneOf:
 *         - $ref: '#/components/schemas/book'
 *         - $ref: '#/components/schemas/podcast'
 *     mediaMinified:
 *       description: The minified media of the library item.
 *       oneOf:
 *         - $ref: '#/components/schemas/bookMinified'
 *         - $ref: '#/components/schemas/podcastMinified'
 *     mediaExpanded:
 *       description: The expanded media of the library item.
 *       oneOf:
 *         - $ref: '#/components/schemas/bookExpanded'
 *         - $ref: '#/components/schemas/podcastExpanded'
 */