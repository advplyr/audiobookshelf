
export const state = () => ({
  feeds: []
})

export const getters = {
  getFeedForItem: state => id => {
    return state.feeds.find(feed => feed.id === id)
  }
}

export const actions = {

}

export const mutations = {
  addFeed(state, feed) {
    var index = state.feeds.findIndex(f => f.id === feed.id)
    if (index >= 0) state.feeds.splice(index, 1, feed)
    else state.feeds.push(feed)
  },
  removeFeed(state, feed) {
    state.feeds = state.feeds.filter(f => f.id !== feed.id)
  },
  setFeeds(state, feeds) {
    state.feeds = feeds || []
  }
}