import type { RequestHandler } from 'express'

declare function fileUpload(options: {
  defCharset: string
  defParamCharset: string
  useTempFiles: boolean
  tempFileDir: string
}): RequestHandler

export = fileUpload
