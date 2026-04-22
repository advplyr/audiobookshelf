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
}

module.exports = OpenAI
