const cron = require('../libs/nodeCron')
const Logger = require('../Logger')

class CronManager {
  constructor(db, scanner) {
    this.db = db
    this.scanner = scanner

    this.libraryScanCrons = []
  }

  init() {
    this.initLibraryScanCrons()
  }

  initLibraryScanCrons() {
    for (const library of this.db.libraries) {
      if (library.settings.autoScanCronExpression) {
        this.startCronForLibrary(library)
      }
    }
  }

  startCronForLibrary(library) {
    Logger.debug(`[CronManager] Init library scan cron for ${library.name} on schedule ${library.settings.autoScanCronExpression}`)
    const libScanCron = cron.schedule(library.settings.autoScanCronExpression, () => {
      Logger.debug(`[CronManager] Library scan cron executing for ${library.name}`)
      this.scanner.scan(library)
    })
    this.libraryScanCrons.push({
      libraryId: library.id,
      expression: library.settings.autoScanCronExpression,
      task: libScanCron
    })
  }

  removeCronForLibrary(library) {
    Logger.debug(`[CronManager] Removing library scan cron for ${library.name}`)
    this.libraryScanCrons = this.libraryScanCrons.filter(lsc => lsc.libraryId !== library.id)
  }

  updateLibraryScanCron(library) {
    const expression = library.settings.autoScanCronExpression
    const existingCron = this.libraryScanCrons.find(lsc => lsc.libraryId === library.id)

    if (!expression && existingCron) {
      if (existingCron.task.stop) existingCron.task.stop()

      this.removeCronForLibrary(library)
    } else if (!existingCron && expression) {
      this.startCronForLibrary(library)
    } else if (existingCron && existingCron.expression !== expression) {
      if (existingCron.task.stop) existingCron.task.stop()

      this.removeCronForLibrary(library)
      this.startCronForLibrary(library)
    }
  }

}
module.exports = CronManager