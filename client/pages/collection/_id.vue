<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full h-full overflow-y-auto px-2 py-6 md:p-8">
      <div class="flex flex-col sm:flex-row max-w-6xl mx-auto">
        <div class="w-full flex justify-center md:block sm:w-32 md:w-52" style="min-width: 240px">
          <div class="relative" style="height: fit-content">
            <covers-collection-cover :book-items="bookItems" :width="240" :height="120 * bookCoverAspectRatio" :book-cover-aspect-ratio="bookCoverAspectRatio" />
          </div>
        </div>
        <div class="grow px-2 py-6 md:py-0 md:px-10">
          <div class="flex items-end flex-row flex-wrap md:flex-nowrap">
            <h1 class="text-2xl md:text-3xl font-sans w-full md:w-fit mb-4 md:mb-0">
              {{ collectionName }}
            </h1>
            <div class="grow" />

            <ui-btn v-if="showPlayButton" :disabled="streaming" color="bg-success" :padding-x="4" small class="flex items-center h-9 mr-2" @click="clickPlay">
              <span v-show="!streaming" class="material-symbols fill text-2xl -ml-2 pr-1 text-white">play_arrow</span>
              {{ streaming ? $strings.ButtonPlaying : $strings.ButtonPlayAll }}
            </ui-btn>

            <!-- RSS feed -->
            <ui-tooltip v-if="rssFeed" :text="$strings.LabelOpenRSSFeed" direction="top">
              <ui-icon-btn icon="rss_feed" class="mx-0.5" :bg-color="rssFeed ? 'bg-success' : 'bg-primary'" outlined @click="showRSSFeedModal" />
            </ui-tooltip>

            <button type="button" class="h-9 w-9 flex items-center justify-center shadow-xs pl-3 pr-3 text-left focus:outline-hidden cursor-pointer text-gray-100 hover:text-gray-200 rounded-full hover:bg-white/5 mx-px" @click.stop.prevent="editClick">
              <span class="material-symbols text-xl">edit</span>
            </button>

            <ui-context-menu-dropdown :items="contextMenuItems" class="mx-px" @action="contextMenuAction" />
          </div>

          <div class="my-8 max-w-2xl">
            <p class="text-base text-gray-100">{{ description }}</p>
          </div>

          <tables-collection-books-table :books="bookItems" :collection-id="collection.id" />
        </div>
      </div>
    </div>
    <div v-show="processing" class="absolute top-0 left-0 w-full h-full z-10 bg-black/40 flex items-center justify-center">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }
    const collection = await app.$axios.$get(`/api/collections/${params.id}?include=rssfeed`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!collection) {
      return redirect('/')
    }

    // If collection is a different library then set library as current
    if (collection.libraryId !== store.state.libraries.currentLibraryId) {
      await store.dispatch('libraries/fetch', collection.libraryId)
    }

    store.commit('libraries/addUpdateCollection', collection)
    return {
      collectionId: collection.id,
      rssFeed: collection.rssFeed || null
    }
  },
  data() {
    return {
      processing: false
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    bookItems() {
      return this.collection.books || []
    },
    collectionName() {
      return this.collection.name || ''
    },
    description() {
      return this.collection.description || ''
    },
    collection() {
      return this.$store.getters['libraries/getCollection'](this.collectionId) || {}
    },
    playableBooks() {
      return this.bookItems.filter((book) => {
        return !book.isMissing && !book.isInvalid && book.media.tracks.length
      })
    },
    streaming() {
      return !!this.playableBooks.some((b) => b.id === this.$store.getters['getLibraryItemIdStreaming'])
    },
    showPlayButton() {
      return this.playableBooks.length
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    contextMenuItems() {
      const items = [
        {
          text: this.$strings.MessagePlaylistCreateFromCollection,
          action: 'create-playlist'
        }
      ]
      if (this.userIsAdminOrUp || this.rssFeed) {
        items.push({
          text: this.$strings.LabelOpenRSSFeed,
          action: 'open-rss-feed'
        })
      }
      if (this.userCanDelete) {
        items.push({
          text: this.$strings.ButtonDelete,
          action: 'delete'
        })
      }
      return items
    }
  },
  methods: {
    showRSSFeedModal() {
      this.$store.commit('globals/setRSSFeedOpenCloseModal', {
        id: this.collectionId,
        name: this.collectionName,
        type: 'collection',
        feed: this.rssFeed
      })
    },
    contextMenuAction({ action }) {
      if (action === 'delete') {
        this.removeClick()
      } else if (action === 'create-playlist') {
        this.createPlaylistFromCollection()
      } else if (action === 'open-rss-feed') {
        this.showRSSFeedModal()
      }
    },
    createPlaylistFromCollection() {
      this.processing = true
      this.$axios
        .$post(`/api/playlists/collection/${this.collectionId}`)
        .then((playlist) => {
          if (playlist) {
            this.$toast.success(this.$strings.ToastPlaylistCreateSuccess)
            this.$router.push(`/playlist/${playlist.id}`)
          }
        })
        .catch((error) => {
          const errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(errMsg || this.$strings.ToastPlaylistCreateFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    editClick() {
      this.$store.commit('globals/setEditCollection', this.collection)
    },
    removeClick() {
      const payload = {
        message: this.$getString('MessageConfirmRemoveCollection', [this.collectionName]),
        callback: (confirmed) => {
          if (confirmed) {
            this.deleteCollection()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    deleteCollection() {
      this.processing = true
      this.$axios
        .$delete(`/api/collections/${this.collection.id}`)
        .then(() => {
          this.$toast.success(this.$strings.ToastCollectionRemoveSuccess)
        })
        .catch((error) => {
          console.error('Failed to remove collection', error)
          this.$toast.error(this.$strings.ToastCollectionRemoveFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    clickPlay() {
      const queueItems = []

      // Collection queue will start at the first unfinished book
      //   if all books are finished then entire collection is queued
      const itemsWithProgress = this.playableBooks.map((item) => {
        return {
          ...item,
          progress: this.$store.getters['user/getUserMediaProgress'](item.id)
        }
      })

      const hasUnfinishedItems = itemsWithProgress.some((i) => !i.progress || !i.progress.isFinished)
      if (!hasUnfinishedItems) {
        console.warn('All items in collection are finished - starting at first item')
      }

      for (let i = 0; i < itemsWithProgress.length; i++) {
        const libraryItem = itemsWithProgress[i]
        if (!hasUnfinishedItems || !libraryItem.progress || !libraryItem.progress.isFinished) {
          queueItems.push({
            libraryItemId: libraryItem.id,
            libraryId: libraryItem.libraryId,
            episodeId: null,
            title: libraryItem.media.metadata.title,
            subtitle: libraryItem.media.metadata.authors.map((au) => au.name).join(', '),
            caption: '',
            duration: libraryItem.media.duration || null,
            coverPath: libraryItem.media.coverPath || null
          })
        }
      }

      if (queueItems.length >= 0) {
        this.$eventBus.$emit('play-item', {
          libraryItemId: queueItems[0].libraryItemId,
          queueItems
        })
      }
    },
    rssFeedOpen(data) {
      if (data.entityId === this.collectionId) {
        console.log('RSS Feed Opened', data)
        this.rssFeed = data
      }
    },
    rssFeedClosed(data) {
      if (data.entityId === this.collectionId) {
        console.log('RSS Feed Closed', data)
        this.rssFeed = null
      }
    }
  },
  mounted() {
    this.$root.socket.on('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.on('rss_feed_closed', this.rssFeedClosed)
  },
  beforeDestroy() {
    this.$root.socket.off('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.off('rss_feed_closed', this.rssFeedClosed)
  }
}
</script>
