// JSON is interpreted at the application boundary without adding runtime validation.
declare const ffprobe: {
  (filepath: string): Promise<unknown>
  FFPROBE_PATH?: string
}

export = ffprobe
