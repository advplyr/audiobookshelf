// Narrow external boundary used by the email service. Settings intentionally
// retain nullable legacy fields; the transport validates configuration itself.
declare module 'nodemailer' {
  type Address = string | null | undefined
  type TransportOptions = { host: Address; secure: boolean; port?: number; auth?: { user: string; pass: string | null }; tls?: { rejectUnauthorized: false } }
  type MailOptions = { from: Address; to: Address; subject: string; text?: string; html?: string; attachments?: { filename: string; path: string }[] }
  export function createTransport(options: TransportOptions): {
    verify(): Promise<boolean>
    sendMail(options: MailOptions): Promise<unknown>
  }
}
