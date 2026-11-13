export const RerunBehavior = {
  /** Hard error if an up migration that has already been run, or a down migration that hasn't, is encountered */
  THROW: 'THROW',
  /** Silently skip up migrations that have already been run, or down migrations that haven't */
  SKIP: 'SKIP',
  /** Re-run up migrations that have already been run, or down migrations that haven't */
  ALLOW: 'ALLOW'
} as const
