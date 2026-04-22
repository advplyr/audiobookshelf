const Path = require('path')
const axios = require('axios')
const Database = require('../Database')
const Logger = require('../Logger')
const htmlSanitizer = require('../utils/htmlSanitizer')

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-5.4-mini'
const RESPONSE_TIMEOUT_MS = 60000
const SEQUENCE_REGEX = /^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/

class OpenAI {
  summarizeBookForLog(book) {
    return JSON.stringify({
      id: book.id,
      title: book.title,
      authors: book.authors,
      fullPath: book.fullPath,
      relPath: book.relPath,
      existingSeries: book.existingSeries,
      currentSequence: book.currentSequence
    })
  }

  summarizeAssignmentForLog(assignment) {
    return JSON.stringify({
      id: assignment.id,
      seriesName: assignment.seriesName || null,
      sequence: assignment.sequence || null,
      reason: assignment.reason || ''
    })
  }

  summarizeScanMetadataForLog(metadata) {
    return JSON.stringify({
      title: metadata.title || null,
      authors: metadata.authors || [],
      seriesName: metadata.seriesName || null,
      sequence: metadata.sequence || null,
      publishedYear: metadata.publishedYear || null,
      reason: metadata.reason || ''
    })
  }

  summarizeDirectoryGroupingForLog(grouping) {
    return JSON.stringify({
      path: grouping.path,
      groupId: grouping.groupId,
      reason: grouping.reason || ''
    })
  }

  normalizePathForPrompt(filePath) {
    if (!filePath || typeof filePath !== 'string') return null
    return filePath.replace(/\\/g, '/')
  }

  getFolderContext(libraryItem) {
    const absolutePath = this.normalizePathForPrompt(libraryItem.path)
    const relativePath = this.normalizePathForPrompt(libraryItem.relPath)
    const basePath = relativePath || absolutePath
    if (!basePath && !absolutePath) {
      return {
        fullPath: null,
        relPath: null,
        itemFolderName: null,
        parentFolderName: null,
        folderHierarchy: [],
        fullPathHierarchy: []
      }
    }

    const itemPath = libraryItem.isFile ? Path.posix.dirname(basePath) : basePath
    const absoluteItemPath = absolutePath ? (libraryItem.isFile ? Path.posix.dirname(absolutePath) : absolutePath) : null
    const folderHierarchy = itemPath
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
    const fullPathHierarchy = absoluteItemPath
      ? absoluteItemPath
          .split('/')
          .map((segment) => segment.trim())
          .filter(Boolean)
      : []

    const itemFolderName = folderHierarchy.length ? folderHierarchy[folderHierarchy.length - 1] : null
    const parentFolderName = folderHierarchy.length > 1 ? folderHierarchy[folderHierarchy.length - 2] : null

    return {
      fullPath: absolutePath,
      relPath: relativePath || basePath,
      itemFolderName,
      parentFolderName,
      folderHierarchy,
      fullPathHierarchy
    }
  }

  normalizeBaseURL(url) {
    return (url || DEFAULT_BASE_URL).replace(/\/+$/, '')
  }

  get apiKey() {
    return Database.serverSettings?.openAIResolvedApiKey || null
  }

  get baseURL() {
    return this.normalizeBaseURL(Database.serverSettings?.openAIResolvedBaseURL || DEFAULT_BASE_URL)
  }

  get model() {
    return Database.serverSettings?.openAIResolvedModel || DEFAULT_MODEL
  }

  get isConfigured() {
    return !!this.apiKey
  }

  cleanDescription(description) {
    if (!description || typeof description !== 'string') return null
    const plain = htmlSanitizer.stripAllTags(description).replace(/\s+/g, ' ').trim()
    if (!plain) return null
    return plain.slice(0, 600)
  }

  buildBookPayload(libraryItem) {
    const book = libraryItem.media
    const metadata = book.oldMetadataToJSON()
    const folderContext = this.getFolderContext(libraryItem)
    return {
      id: libraryItem.id,
      title: metadata.title || null,
      subtitle: metadata.subtitle || null,
      publishedYear: metadata.publishedYear || null,
      authors: (metadata.authors || []).map((author) => author.name),
      description: this.cleanDescription(metadata.description),
      fullPath: folderContext.fullPath,
      relPath: folderContext.relPath,
      itemFolderName: folderContext.itemFolderName,
      parentFolderName: folderContext.parentFolderName,
      folderHierarchy: folderContext.folderHierarchy,
      fullPathHierarchy: folderContext.fullPathHierarchy,
      existingSeries: (metadata.series || []).map((series) => ({
        name: series.name,
        sequence: series.sequence || null
      }))
    }
  }

  extractTextFromResponse(data) {
    if (typeof data?.output_text === 'string' && data.output_text.trim()) {
      return data.output_text.trim()
    }

    const texts = []
    for (const outputItem of data?.output || []) {
      if (typeof outputItem?.text === 'string' && outputItem.text.trim()) {
        texts.push(outputItem.text.trim())
      }
      for (const contentItem of outputItem?.content || []) {
        if (typeof contentItem?.text === 'string' && contentItem.text.trim()) {
          texts.push(contentItem.text.trim())
        } else if (typeof contentItem?.output_text === 'string' && contentItem.output_text.trim()) {
          texts.push(contentItem.output_text.trim())
        }
      }
    }

    return texts.join('\n').trim()
  }

  parseJsonResponse(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('OpenAI returned an empty response')
    }

    let cleanedText = text.trim()
    const fencedMatch = cleanedText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    if (fencedMatch) {
      cleanedText = fencedMatch[1].trim()
    }

    try {
      return JSON.parse(cleanedText)
    } catch (error) {
      const start = cleanedText.indexOf('{')
      const end = cleanedText.lastIndexOf('}')
      if (start >= 0 && end > start) {
        return JSON.parse(cleanedText.slice(start, end + 1))
      }
      throw error
    }
  }

  normalizeSeriesName(value) {
    if (!value || typeof value !== 'string') return null
    const seriesName = value.trim()
    return seriesName || null
  }

  normalizeSequence(value) {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') value = String(value)
    if (typeof value !== 'string') return null

    const sequence = value.trim()
    if (!SEQUENCE_REGEX.test(sequence)) return null
    return sequence
  }

  normalizeOptionalString(value, maxLength = 300) {
    if (value === null || value === undefined) return null
    if (typeof value !== 'string') return null
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (!normalized) return null
    return normalized.slice(0, maxLength)
  }

  normalizeStringArray(value, maxItems = 10, maxLength = 120) {
    if (!Array.isArray(value)) return []

    const deduped = []
    const seen = new Set()
    for (const item of value) {
      const normalized = this.normalizeOptionalString(item, maxLength)
      if (!normalized) continue
      const key = normalized.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(normalized)
      if (deduped.length >= maxItems) break
    }
    return deduped
  }

  normalizePublishedYear(value) {
    if (value === null || value === undefined) return null
    if (typeof value === 'number' && Number.isInteger(value)) value = String(value)
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    if (!/^\d{4}$/.test(normalized)) return null
    return normalized
  }

  normalizeIsbn(value) {
    const normalized = this.normalizeOptionalString(value, 20)
    if (!normalized) return null
    const compact = normalized.replace(/[-\s]/g, '')
    if (!/^(?:\d{10}|\d{13}|[0-9X]{10})$/i.test(compact)) return null
    return compact
  }

  normalizeAsin(value) {
    const normalized = this.normalizeOptionalString(value, 10)
    if (!normalized) return null
    return /^[A-Z0-9]{10}$/i.test(normalized) ? normalized.toUpperCase() : null
  }

  validateScanMetadataPayload(payload) {
    const book = payload?.book && typeof payload.book === 'object' ? payload.book : payload
    if (!book || typeof book !== 'object' || Array.isArray(book)) {
      throw new Error('OpenAI returned invalid scan metadata payload')
    }

    const seriesName = this.normalizeSeriesName(book.seriesName)

    return {
      title: this.normalizeOptionalString(book.title),
      subtitle: this.normalizeOptionalString(book.subtitle),
      publishedYear: this.normalizePublishedYear(book.publishedYear),
      publisher: this.normalizeOptionalString(book.publisher),
      isbn: this.normalizeIsbn(book.isbn),
      asin: this.normalizeAsin(book.asin),
      language: this.normalizeOptionalString(book.language, 40),
      authors: this.normalizeStringArray(book.authors),
      narrators: this.normalizeStringArray(book.narrators),
      seriesName,
      sequence: seriesName ? this.normalizeSequence(book.sequence) : null,
      reason: this.normalizeOptionalString(book.reason, 600) || ''
    }
  }

  validateDirectoryGroupingPayload(payload, mediaFiles) {
    const resultFiles = payload?.files
    if (!Array.isArray(resultFiles)) {
      throw new Error('OpenAI returned invalid directory-grouping payload')
    }

    const expectedPaths = new Set(mediaFiles.map((file) => file.path))
    const resultByPath = new Map()

    resultFiles.forEach((file) => {
      if (!expectedPaths.has(file?.path)) {
        Logger.warn(`[OpenAI] Ignoring unknown media path "${file?.path}" in directory-grouping response`)
        return
      }
      if (resultByPath.has(file.path)) {
        Logger.warn(`[OpenAI] Ignoring duplicate media path "${file.path}" in directory-grouping response`)
        return
      }
      resultByPath.set(file.path, file)
    })

    return mediaFiles.map((file) => {
      const result = resultByPath.get(file.path)
      const groupId = this.normalizeOptionalString(result?.groupId, 120) || file.path
      const reason = this.normalizeOptionalString(result?.reason, 600) || (result ? '' : 'OpenAI omitted this media file; kept it as its own item')
      if (!result) {
        Logger.warn(`[OpenAI] Missing directory-grouping result for media path "${file.path}" - keeping it separate`)
      }
      return {
        path: file.path,
        groupId,
        reason
      }
    })
  }

  validateBookIds(resultBooks, books) {
    if (!Array.isArray(resultBooks) || resultBooks.length !== books.length) {
      throw new Error('OpenAI returned an invalid number of books')
    }

    const expectedIds = new Set(books.map((book) => book.id))
    const seenIds = new Set()

    resultBooks.forEach((book) => {
      if (!expectedIds.has(book?.id)) {
        throw new Error(`OpenAI returned an unknown book id "${book?.id}"`)
      }
      if (seenIds.has(book.id)) {
        throw new Error(`OpenAI returned duplicate book id "${book.id}"`)
      }
      seenIds.add(book.id)
    })
  }

  normalizeDetectionResultBooks(resultBooks, books) {
    if (!Array.isArray(resultBooks)) {
      throw new Error('OpenAI returned an invalid books payload')
    }

    const expectedIds = new Set(books.map((book) => book.id))
    const resultBooksById = new Map()

    resultBooks.forEach((book) => {
      if (!expectedIds.has(book?.id)) {
        Logger.warn(`[OpenAI] Ignoring unknown book id "${book?.id}" in series-detection response`)
        return
      }
      if (resultBooksById.has(book.id)) {
        Logger.warn(`[OpenAI] Ignoring duplicate book id "${book.id}" in series-detection response`)
        return
      }
      resultBooksById.set(book.id, book)
    })

    return books.map((book) => {
      if (resultBooksById.has(book.id)) {
        return resultBooksById.get(book.id)
      }

      Logger.warn(`[OpenAI] Missing series-detection result for book "${book.id}" - skipping assignment`)
      return {
        id: book.id,
        seriesName: null,
        sequence: null,
        reason: 'Skipped because OpenAI omitted this book from the response'
      }
    })
  }

  validateSeriesOrderPayload(payload, books) {
    const resultBooks = payload?.books
    this.validateBookIds(resultBooks, books)

    const sequences = new Set()
    return resultBooks
      .map((book) => {
        const sequence = this.normalizeSequence(book.sequence)
        if (!sequence) {
          throw new Error(`OpenAI returned an invalid sequence for "${book.id}"`)
        }
        if (sequences.has(sequence)) {
          throw new Error(`OpenAI returned a duplicate sequence "${sequence}"`)
        }
        sequences.add(sequence)
        return {
          id: book.id,
          sequence,
          reason: typeof book.reason === 'string' ? book.reason.trim() : ''
        }
      })
      .sort((a, b) => Number(a.sequence) - Number(b.sequence))
  }

  validateSeriesDetectionPayload(payload, books) {
    const resultBooks = this.normalizeDetectionResultBooks(payload?.books, books)

    const seriesSequences = new Map()
    return resultBooks.map((book) => {
      const seriesName = this.normalizeSeriesName(book.seriesName)
      const sequence = this.normalizeSequence(book.sequence)
      const reason = typeof book.reason === 'string' ? book.reason.trim() : ''

      if (seriesName && !sequence) {
        Logger.warn(`[OpenAI] Series "${seriesName}" for book "${book.id}" did not include a valid sequence - skipping assignment`)
        return {
          id: book.id,
          seriesName: null,
          sequence: null,
          reason: reason ? `${reason} (skipped due to missing or invalid sequence)` : 'Skipped due to missing or invalid sequence'
        }
      }
      if (!seriesName && sequence) {
        Logger.warn(`[OpenAI] Sequence "${sequence}" for book "${book.id}" did not include a series name - skipping assignment`)
        return {
          id: book.id,
          seriesName: null,
          sequence: null,
          reason: reason ? `${reason} (skipped due to missing series name)` : 'Skipped due to missing series name'
        }
      }

      if (seriesName && sequence) {
        const key = seriesName.toLowerCase()
        if (!seriesSequences.has(key)) {
          seriesSequences.set(key, new Set())
        }
        if (seriesSequences.get(key).has(sequence)) {
          Logger.warn(`[OpenAI] Duplicate inferred sequence "${sequence}" inside "${seriesName}" for book "${book.id}" - skipping assignment`)
          return {
            id: book.id,
            seriesName: null,
            sequence: null,
            reason: reason ? `${reason} (skipped due to duplicate inferred sequence)` : 'Skipped due to duplicate inferred sequence'
          }
        }
        seriesSequences.get(key).add(sequence)
      }

      return {
        id: book.id,
        seriesName,
        sequence,
        reason
      }
    })
  }

  async createResponse(prompt) {
    if (!this.isConfigured) {
      throw new Error('OpenAI API key is not configured')
    }

    const url = `${this.baseURL}/responses`
    Logger.debug(`[OpenAI] Requesting ${url} with model "${this.model}"`)

    const response = await axios
      .post(
        url,
        {
          model: this.model,
          input: prompt
        },
        {
          timeout: RESPONSE_TIMEOUT_MS,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )
      .catch((error) => {
        const status = error.response?.status
        const message = error.response?.data?.error?.message || error.message
        Logger.error(`[OpenAI] Responses API request failed (${status || 'no-status'})`, message)
        if (status === 401) {
          throw new Error('OpenAI rejected the API key')
        } else if (status === 429) {
          throw new Error('OpenAI rate limit reached')
        } else if (status) {
          throw new Error(`OpenAI request failed with status ${status}`)
        }
        throw new Error(`OpenAI request failed: ${message}`)
      })

    const text = this.extractTextFromResponse(response.data)
    const parsed = this.parseJsonResponse(text)
    Logger.debug(`[OpenAI] Parsed response payload: ${JSON.stringify(parsed)}`)
    return parsed
  }

  async getSeriesOrder(series, libraryItems) {
    const books = libraryItems.map((libraryItem) => {
      const book = this.buildBookPayload(libraryItem)
      const currentSeries = book.existingSeries.find((existingSeries) => existingSeries.name.toLowerCase() === series.name.toLowerCase())
      return {
        ...book,
        currentSequence: currentSeries?.sequence || null
      }
    })

    Logger.info(`[OpenAI] Evaluating story order for series "${series.name}" with ${books.length} books`)
    books.forEach((book) => {
      Logger.info(`[OpenAI] Story-order candidate ${this.summarizeBookForLog(book)}`)
    })

    const prompt = `You organize audiobooks into the correct in-universe story order for a single series.

Return only valid JSON in this shape:
{
  "books": [
    {
      "id": "library-item-id",
      "sequence": "1",
      "reason": "brief reason"
    }
  ]
}

Rules:
- Include every provided book exactly once.
- Use numeric string sequences only.
- Sequences must be unique and reflect story order, not shelf order.
- Prefer existing sequence values when they already look plausible.
- If evidence is weak, preserve the current sequence when present; otherwise fall back to publishedYear, then title.
- Do not invent books or series.

Series:
${JSON.stringify({ id: series.id, name: series.name, description: this.cleanDescription(series.description) }, null, 2)}

Books:
${JSON.stringify(books, null, 2)}`

    const payload = await this.createResponse(prompt)
    const validated = this.validateSeriesOrderPayload(payload, books)
    validated.forEach((book) => {
      Logger.info(`[OpenAI] Story-order result ${JSON.stringify({ id: book.id, sequence: book.sequence, reason: book.reason || '' })}`)
    })
    return validated
  }

  async detectSeriesAssignments(contextLabel, libraryItems, contextType = 'author') {
    const books = libraryItems.map((libraryItem) => this.buildBookPayload(libraryItem))

    Logger.info(`[OpenAI] Detecting series assignments for ${contextType} "${contextLabel}" with ${books.length} books`)
    books.forEach((book) => {
      Logger.info(`[OpenAI] Series-detection candidate ${this.summarizeBookForLog(book)}`)
    })

    const contextDescription =
      contextType === 'folder'
        ? 'These books were grouped because they share the same folder context. Folder structure may be more reliable than author metadata for this group.'
        : 'These books were grouped by primary author.'

    const contextHeading = contextType === 'folder' ? 'Grouping context' : 'Primary author'

    const prompt = `You detect audiobook series membership for a group of related books.

Return only valid JSON in this shape:
{
  "books": [
    {
      "id": "library-item-id",
      "seriesName": "Series Name or null",
      "sequence": "1 or null",
      "reason": "brief reason"
    }
  ]
}

Rules:
- Include every provided book exactly once.
- Use "seriesName": null and "sequence": null for standalones or uncertain books.
- When assigning a series, use a numeric string sequence.
- Reuse an existing series name when it already appears in the provided data.
- Full absolute path and relative path are both available and should be used as evidence.
- Books sharing the same parent folder or series-like folder names are strong evidence they belong together.
- Use folder hierarchy as evidence alongside title, subtitle, description, and existing metadata.
- Do not invent series when the evidence is weak.
- Existing series metadata is trusted context and should usually be preserved.

${contextHeading}:
${JSON.stringify(contextLabel)}

Context note:
${contextDescription}

Books:
${JSON.stringify(books, null, 2)}`

    const payload = await this.createResponse(prompt)
    const validated = this.validateSeriesDetectionPayload(payload, books)
    validated.forEach((assignment) => {
      Logger.info(`[OpenAI] Series-detection result ${this.summarizeAssignmentForLog(assignment)}`)
    })
    return validated
  }

  async inferBookMetadataFromScan(libraryItemData, audioFiles = [], ebookFileScanData = null) {
    if (!this.isConfigured) {
      throw new Error('OpenAI API key is not configured')
    }

    const folderContext = this.getFolderContext(libraryItemData)
    const audioFileCandidates = (audioFiles || []).slice(0, 25).map((audioFile) => ({
      relPath: this.normalizePathForPrompt(audioFile.metadata?.relPath),
      filename: audioFile.metadata?.filename || null,
      duration: audioFile.duration || null,
      trackNumber: audioFile.trackNumFromMeta || audioFile.metaTags?.trackNumber || null,
      discNumber: audioFile.discNumFromMeta || audioFile.metaTags?.discNumber || null,
      metaTags: {
        tagTitle: audioFile.metaTags?.tagTitle || null,
        tagAlbum: audioFile.metaTags?.tagAlbum || null,
        tagArtist: audioFile.metaTags?.tagArtist || null,
        tagAlbumArtist: audioFile.metaTags?.tagAlbumArtist || null,
        tagSeries: audioFile.metaTags?.tagSeries || null,
        tagSeriesPart: audioFile.metaTags?.tagSeriesPart || null,
        tagSubtitle: audioFile.metaTags?.tagSubtitle || null,
        tagDate: audioFile.metaTags?.tagDate || null,
        tagASIN: audioFile.metaTags?.tagASIN || null
      }
    }))

    const ebookMetadata = ebookFileScanData?.metadata
      ? {
          title: ebookFileScanData.metadata.title || null,
          subtitle: ebookFileScanData.metadata.subtitle || null,
          authors: ebookFileScanData.metadata.authors || [],
          narrators: ebookFileScanData.metadata.narrators || [],
          series: ebookFileScanData.metadata.series || [],
          publishedYear: ebookFileScanData.metadata.publishedYear || null,
          isbn: ebookFileScanData.metadata.isbn || null,
          asin: ebookFileScanData.metadata.asin || null
        }
      : null

    const currentPathMetadata = {
      title: libraryItemData.mediaMetadata?.title || null,
      subtitle: libraryItemData.mediaMetadata?.subtitle || null,
      authors: libraryItemData.mediaMetadata?.authors || [],
      narrators: libraryItemData.mediaMetadata?.narrators || [],
      seriesName: libraryItemData.mediaMetadata?.seriesName || null,
      sequence: libraryItemData.mediaMetadata?.seriesSequence || null,
      publishedYear: libraryItemData.mediaMetadata?.publishedYear || null
    }

    Logger.info(`[OpenAI] Inferring scan metadata for "${libraryItemData.relPath}"`)

    const prompt = `You infer audiobook metadata from weak or messy directory structures.

Return only valid JSON in this shape:
{
  "book": {
    "title": "Book title or null",
    "subtitle": "Subtitle or null",
    "authors": ["Author Name"],
    "narrators": ["Narrator Name"],
    "seriesName": "Series name or null",
    "sequence": "1 or null",
    "publishedYear": "2004 or null",
    "publisher": "Publisher or null",
    "isbn": "ISBN or null",
    "asin": "ASIN or null",
    "language": "Language or null",
    "reason": "brief reason"
  }
}

Rules:
- Infer metadata from full path, relative path, folder names, filenames, and any provided tag metadata.
- Prefer title/author/series evidence that is explicit in filenames or tags.
- Use null when uncertain.
- If a series is provided, sequence may be null when it cannot be inferred confidently.
- Do not invent authors or series when there is weak evidence.
- Respond with one book object only.

Current path-derived metadata:
${JSON.stringify(currentPathMetadata, null, 2)}

Folder context:
${JSON.stringify(folderContext, null, 2)}

Audio files:
${JSON.stringify(audioFileCandidates, null, 2)}

Ebook metadata:
${JSON.stringify(ebookMetadata, null, 2)}`

    const payload = await this.createResponse(prompt)
    const validated = this.validateScanMetadataPayload(payload)
    Logger.info(`[OpenAI] Scan-metadata result for "${libraryItemData.relPath}" ${this.summarizeScanMetadataForLog(validated)}`)
    return validated
  }

  async inferDirectoryGroupingFromPaths(containerPath, mediaFiles) {
    if (!this.isConfigured) {
      throw new Error('OpenAI API key is not configured')
    }
    if (!Array.isArray(mediaFiles) || !mediaFiles.length) {
      return []
    }

    Logger.info(`[OpenAI] Inferring directory grouping for "${containerPath}" with ${mediaFiles.length} media files`)
    mediaFiles.forEach((file) => {
      Logger.info(`[OpenAI] Directory-grouping candidate ${JSON.stringify(file)}`)
    })

    const prompt = `You infer logical audiobook item grouping from messy filesystem paths.

Return only valid JSON in this shape:
{
  "files": [
    {
      "path": "relative/path/to/media-file.m4b",
      "groupId": "short-group-label",
      "reason": "brief reason"
    }
  ]
}

Rules:
- Include every provided media file exactly once.
- Files that belong to the same logical audiobook item must share the same groupId.
- Files for different books must use different groupIds even if they are in the same series container.
- Use path, filename, parent directories, and current grouping hints as evidence.
- Prefer preserving existing grouping when it already looks reasonable.
- Do not merge different titled books just because they share a series or author folder.
- groupId only needs to be stable within this one response.

Container path:
${JSON.stringify(containerPath)}

Media files:
${JSON.stringify(mediaFiles, null, 2)}`

    const payload = await this.createResponse(prompt)
    const validated = this.validateDirectoryGroupingPayload(payload, mediaFiles)
    validated.forEach((grouping) => {
      Logger.info(`[OpenAI] Directory-grouping result ${this.summarizeDirectoryGroupingForLog(grouping)}`)
    })
    return validated
  }
}

module.exports = OpenAI
