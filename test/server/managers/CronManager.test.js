const { expect } = require('chai')
const sinon = require('sinon')

const cron = require('../../../server/libs/nodeCron')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const CronManager = require('../../../server/managers/CronManager')

describe('CronManager', () => {
  describe('podcast episode crons', () => {
    const expression = '0 * * * *'
    let scheduledTasks
    let podcastManager
    let cronManager

    beforeEach(() => {
      scheduledTasks = []
      sinon.stub(cron, 'schedule').callsFake((_expression, func) => {
        const task = { func, stop: sinon.stub() }
        scheduledTasks.push(task)
        return task
      })
      sinon.stub(Database, 'libraryItemModel').get(() => ({
        getExpandedById: async (id) => ({ id, media: { title: `Podcast ${id}` } })
      }))
      sinon.stub(Logger, 'debug')
      sinon.stub(Logger, 'info')
      sinon.stub(Logger, 'warn')
      sinon.stub(Logger, 'error')

      podcastManager = { runEpisodeCheck: sinon.stub() }
      cronManager = new CronManager(podcastManager, null)
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should run a new cron for a schedule whose previous cron was removed while executing', async () => {
      // Auto download gets disabled for the only podcast on this schedule during the check
      // (e.g. after too many failed feed fetches), so the cron is stopped and removed
      podcastManager.runEpisodeCheck.resolves(false)
      cronManager.startPodcastCron(expression, ['li1'])
      await cronManager.executePodcastCron(expression)

      expect(cronManager.podcastCrons).to.have.lengthOf(0)
      expect(scheduledTasks[0].stop.calledOnce).to.be.true

      // Auto download is turned back on with the same schedule
      cronManager.checkUpdatePodcastCron({ id: 'li2', media: { title: 'Podcast li2', autoDownloadEpisodes: true, autoDownloadSchedule: expression } })
      expect(scheduledTasks).to.have.lengthOf(2)

      // The new cron ticks
      podcastManager.runEpisodeCheck.resetHistory()
      podcastManager.runEpisodeCheck.resolves(true)
      const executeSpy = sinon.spy(cronManager, 'executePodcastCron')
      scheduledTasks[1].func()
      await Promise.all(executeSpy.returnValues)

      expect(podcastManager.runEpisodeCheck.calledOnce).to.be.true
      expect(podcastManager.runEpisodeCheck.firstCall.args[0].id).to.equal('li2')
      expect(Logger.warn.calledWithMatch('is already executing')).to.be.false
    })
  })
})
