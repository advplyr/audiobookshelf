import EpisodeFeed from '@/components/modals/podcast/EpisodeFeed.vue'

const MAX_EPISODE_REQUEST_BYTES = 9 * 1024 * 1024
const encoder = new TextEncoder()

function makeEpisode(index, description = '') {
  return {
    cleanUrl: `https://example.com/${index}.mp3`,
    title: `Episode ${index}`,
    description,
    enclosure: { url: `https://example.com/${index}.mp3` }
  }
}

function makeContext(episodes, post = async () => {}) {
  const messages = { success: [], error: [] }
  const calls = []
  const selectedEpisodes = Object.fromEntries(episodes.map((episode) => [episode.cleanUrl, true]))
  const context = {
    episodesCleaned: episodes,
    selectedEpisodes,
    selectAll: true,
    processing: false,
    show: true,
    libraryItem: { id: 'podcast-id' },
    get episodesSelected() {
      return Object.keys(this.selectedEpisodes).filter((key) => this.selectedEpisodes[key])
    },
    $set(object, key, value) {
      object[key] = value
    },
    $toast: {
      success(message) {
        messages.success.push(message)
      },
      error(message) {
        messages.error.push(message)
      }
    },
    $axios: {
      async $post(url, batch) {
        calls.push({ url, batch })
        await post(url, batch, calls.length)
      }
    }
  }
  return { context, calls, messages }
}

describe('EpisodeFeed download batching', () => {
  it('submits a small selection in one request', async () => {
    const episodes = [makeEpisode(1), makeEpisode(2)]
    const { context, calls, messages } = makeContext(episodes)

    await EpisodeFeed.methods.submit.call(context)

    expect(calls).to.have.length(1)
    expect(calls[0].url).to.equal('/api/podcasts/podcast-id/download-episodes')
    expect(calls[0].batch).to.deep.equal(episodes)
    expect(messages.success).to.have.length(1)
    expect(context.show).to.equal(false)
    expect(context.processing).to.equal(false)
  })

  it('submits every episode once, in order, with sequential byte-limited requests', async () => {
    const episodes = Array.from({ length: 12 }, (_, index) => makeEpisode(index, 'x'.repeat(1024 * 1024)))
    let inFlight = false
    const { context, calls } = makeContext(episodes, async () => {
      expect(inFlight).to.equal(false)
      inFlight = true
      await Promise.resolve()
      inFlight = false
    })

    await EpisodeFeed.methods.submit.call(context)

    expect(calls.length).to.be.greaterThan(1)
    expect(calls.flatMap(({ batch }) => batch)).to.deep.equal(episodes)
    for (const { batch } of calls) {
      expect(encoder.encode(JSON.stringify(batch)).length).to.be.at.most(MAX_EPISODE_REQUEST_BYTES)
    }
  })

  it('measures non-ASCII metadata in UTF-8 bytes', async () => {
    const episodes = Array.from({ length: 6 }, (_, index) => makeEpisode(index, '漢'.repeat(1024 * 1024)))
    const { context, calls } = makeContext(episodes)
    expect(JSON.stringify(episodes).length).to.be.lessThan(MAX_EPISODE_REQUEST_BYTES)
    expect(encoder.encode(JSON.stringify(episodes)).length).to.be.greaterThan(MAX_EPISODE_REQUEST_BYTES)

    await EpisodeFeed.methods.submit.call(context)

    expect(calls.length).to.be.greaterThan(1)
    expect(calls.flatMap(({ batch }) => batch)).to.deep.equal(episodes)
    for (const { batch } of calls) {
      expect(encoder.encode(JSON.stringify(batch)).length).to.be.at.most(MAX_EPISODE_REQUEST_BYTES)
    }
  })

  it('rejects an individually oversized episode without submitting any batch', async () => {
    const { context, calls, messages } = makeContext([makeEpisode(1, 'x'.repeat(10 * 1024 * 1024))])

    await EpisodeFeed.methods.submit.call(context)

    expect(calls).to.have.length(0)
    expect(messages.error[0]).to.include('too large')
    expect(context.episodesSelected).to.have.length(1)
    expect(context.show).to.equal(true)
  })

  it('stops after a failed batch and retains failed and unsent selections', async () => {
    const episodes = Array.from({ length: 20 }, (_, index) => makeEpisode(index, 'x'.repeat(1024 * 1024)))
    const { context, calls, messages } = makeContext(episodes, async (url, batch, callNumber) => {
      if (callNumber === 2) throw new Error('Request failed')
    })

    await EpisodeFeed.methods.submit.call(context)

    expect(calls).to.have.length(2)
    expect(context.episodesSelected).to.deep.equal(episodes.slice(calls[0].batch.length).map((episode) => episode.cleanUrl))
    expect(messages.success).to.have.length(0)
    expect(messages.error[0]).to.include(`${calls[0].batch.length} episodes accepted`)
    expect(context.show).to.equal(true)
    expect(context.processing).to.equal(false)
  })
})
