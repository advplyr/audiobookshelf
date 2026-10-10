// Boundary for the embedded node-rss API used by the backend.
declare class RSS {
  constructor(options?: RSS.FeedOptions, items?: RSS.ItemOptions[])
  item(options?: RSS.ItemOptions): this
  xml(indent?: boolean | string): string
}
declare namespace RSS {
  type CustomValue = string | number | boolean | null | undefined | CustomElement | CustomElement[]
  type CustomElement = { [name: string]: CustomValue }
  interface FeedOptions {
    title?: string | null
    description?: string | null
    generator?: string
    feed_url?: string
    site_url?: string
    image_url?: string
    custom_namespaces?: Record<string, string>
    custom_elements?: CustomElement[]
  }
  interface ItemOptions {
    title?: string | null
    description?: string | null
    url?: string
    guid?: string
    author?: string | null
    date?: string | null
    enclosure?: { url: string; type?: string | null; size?: number | string | null }
    custom_elements?: CustomElement[]
  }
}
export = RSS
