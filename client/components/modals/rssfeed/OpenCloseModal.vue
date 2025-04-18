<template>
  <modals-modal v-model="show" name="rss-feed-modal" :width="600" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" class="px-8 py-6 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div v-if="currentFeed" class="w-full">
        <p class="text-lg font-semibold mb-4">{{ $strings.HeaderRSSFeedIsOpen }}</p>

        <div class="w-full relative">
          <ui-text-input :value="feedUrl" readonly show-copy />
        </div>

        <div v-if="currentFeed.meta" class="mt-5">
          <div class="flex py-0.5">
            <div class="w-48">
              <span class="text-white/60 uppercase text-sm">{{ $strings.LabelRSSFeedPreventIndexing }}</span>
            </div>
            <div>{{ currentFeed.meta.preventIndexing ? 'Yes' : 'No' }}</div>
          </div>
          <div v-if="currentFeed.meta.ownerName" class="flex py-0.5">
            <div class="w-48">
              <span class="text-white/60 uppercase text-sm">{{ $strings.LabelRSSFeedCustomOwnerName }}</span>
            </div>
            <div>{{ currentFeed.meta.ownerName }}</div>
          </div>
          <div v-if="currentFeed.meta.ownerEmail" class="flex py-0.5">
            <div class="w-48">
              <span class="text-white/60 uppercase text-sm">{{ $strings.LabelRSSFeedCustomOwnerEmail }}</span>
            </div>
            <div>{{ currentFeed.meta.ownerEmail }}</div>
          </div>
        </div>
      </div>
      <div v-else class="w-full">
        <p class="text-lg font-semibold mb-4">{{ $strings.HeaderOpenRSSFeed }}</p>

        <div class="w-full relative mb-2">
          <ui-text-input-with-label v-model="newFeedSlug" :label="$strings.LabelRSSFeedSlug" />
          <p class="text-xs text-gray-400 py-0.5 px-1">{{ $getString('MessageFeedURLWillBe', [demoFeedUrl]) }}</p>
        </div>
        <widgets-rss-feed-metadata-builder v-model="metadataDetails" />

        <p v-if="isHttp" class="w-full pt-2 text-warning text-xs">{{ $strings.NoteRSSFeedPodcastAppsHttps }}</p>
        <p v-if="hasEpisodesWithoutPubDate" class="w-full pt-2 text-warning text-xs">{{ $strings.NoteRSSFeedPodcastAppsPubDate }}</p>
      </div>
      <div v-show="userIsAdminOrUp" class="flex items-center pt-6">
        <div class="grow" />
        <ui-btn v-if="currentFeed" color="bg-error" small @click="closeFeed">{{ $strings.ButtonCloseFeed }}</ui-btn>
        <ui-btn v-else color="bg-success" small @click="openFeed">{{ $strings.ButtonOpenFeed }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      newFeedSlug: null,
      currentFeed: null,
      metadataDetails: {
        preventIndexing: true,
        ownerName: '',
        ownerEmail: ''
      }
    }
  },
  watch: {
    show: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showRSSFeedOpenCloseModal
      },
      set(val) {
        this.$store.commit('globals/setShowRSSFeedOpenCloseModal', val)
      }
    },
    rssFeedEntity() {
      return this.$store.state.globals.rssFeedEntity || {}
    },
    entityId() {
      return this.rssFeedEntity.id
    },
    entityType() {
      return this.rssFeedEntity.type
    },
    entityFeed() {
      return this.rssFeedEntity.feed
    },
    hasEpisodesWithoutPubDate() {
      return !!this.rssFeedEntity.hasEpisodesWithoutPubDate
    },
    title() {
      return this.rssFeedEntity.name
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    feedUrl() {
      return this.currentFeed ? `${window.origin}${this.$config.routerBasePath}${this.currentFeed.feedUrl}` : ''
    },
    demoFeedUrl() {
      return `${window.origin}${this.$config.routerBasePath}/feed/${this.newFeedSlug}`
    },
    isHttp() {
      return window.origin.startsWith('http://')
    }
  },
  methods: {
    openFeed() {
      if (!this.newFeedSlug) {
        this.$toast.error(this.$strings.ToastSlugRequired)
        return
      }

      const sanitized = this.$sanitizeSlug(this.newFeedSlug)
      if (this.newFeedSlug !== sanitized) {
        this.newFeedSlug = sanitized
        this.$toast.warning(this.$strings.ToastSlugMustChange)
        return
      }

      this.processing = true

      const payload = {
        serverAddress: window.origin,
        slug: this.newFeedSlug,
        metadataDetails: this.metadataDetails
      }
      if (this.$isDev) payload.serverAddress = process.env.serverUrl

      console.log('Payload', payload)
      this.$axios
        .$post(`/api/feeds/${this.entityType}/${this.entityId}/open`, payload)
        .then((data) => {
          console.log('Opened RSS Feed', data)
          this.currentFeed = data.feed
        })
        .catch((error) => {
          console.error('Failed to open RSS Feed', error)
          const errorMsg = error.response ? error.response.data : null
          this.$toast.error(errorMsg || 'Failed to open RSS Feed')
        })
        .finally(() => {
          this.processing = false
        })
    },
    closeFeed() {
      this.processing = true
      this.$axios
        .$post(`/api/feeds/${this.currentFeed.id}/close`)
        .then(() => {
          this.$toast.success(this.$strings.ToastRSSFeedCloseSuccess)
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to close RSS feed', error)
          this.$toast.error(this.$strings.ToastRSSFeedCloseFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    init() {
      if (!this.entityId) return
      this.newFeedSlug = this.entityId
      this.currentFeed = this.entityFeed
    }
  },
  mounted() {}
}
</script>
