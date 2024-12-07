<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderRSSFeeds">
      <template #header-items>
        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides/rss_feeds" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>
      </template>

      <div v-if="feeds.length" class="block max-w-full pt-2">
        <table class="rssFeedsTable text-xs">
          <tr class="bg-primary bg-opacity-40 h-12">
            <th class="w-16 min-w-16"></th>
            <th class="w-48 max-w-64 min-w-24 text-left truncate">{{ $strings.LabelTitle }}</th>
            <th class="w-48 min-w-24 text-left hidden xl:table-cell">{{ $strings.LabelSlug }}</th>
            <th class="w-24 min-w-16 text-left hidden md:table-cell">{{ $strings.LabelType }}</th>
            <th class="w-16 min-w-16 text-center">{{ $strings.HeaderEpisodes }}</th>
            <th class="w-16 min-w-16 text-center hidden lg:table-cell">{{ $strings.LabelRSSFeedPreventIndexing }}</th>
            <th class="w-48 min-w-24 flex-grow hidden md:table-cell">{{ $strings.LabelLastUpdate }}</th>
            <th class="w-16 text-left"></th>
          </tr>

          <tr v-for="feed in feeds" :key="feed.id" class="cursor-pointer h-12" @click="showFeed(feed)">
            <!--  -->
            <td>
              <img :src="coverUrl(feed)" class="h-full w-full" />
            </td>
            <!--  -->
            <td class="w-48 max-w-64 min-w-24 text-left truncate">
              <p class="truncate">{{ feed.meta.title }}</p>
            </td>
            <!--  -->
            <td class="hidden xl:table-cell">
              <p class="truncate">{{ feed.slug }}</p>
            </td>
            <!--  -->
            <td class="hidden md:table-cell">
              <p class="">{{ getEntityType(feed.entityType) }}</p>
            </td>
            <!--  -->
            <td class="text-center">
              <p class="">{{ feed.episodes.length }}</p>
            </td>
            <!--  -->
            <td class="text-center leading-none hidden lg:table-cell">
              <p v-if="feed.meta.preventIndexing" class="">
                <span class="material-symbols text-2xl">check</span>
              </p>
            </td>
            <!--  -->
            <td class="text-center hidden md:table-cell">
              <ui-tooltip v-if="feed.updatedAt" direction="top" :text="$formatDatetime(feed.updatedAt, dateFormat, timeFormat)">
                <p class="text-gray-200">{{ $dateDistanceFromNow(feed.updatedAt) }}</p>
              </ui-tooltip>
            </td>
            <!--  -->
            <td class="text-center">
              <ui-icon-btn icon="delete" class="mx-0.5" :size="7" bg-color="error" outlined @click.stop="deleteFeedClick(feed)" />
            </td>
          </tr>
        </table>
      </div>
    </app-settings-content>
    <modals-rssfeed-view-feed-modal v-model="showFeedModal" :feed="selectedFeed" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      showFeedModal: false,
      selectedFeed: null,
      feeds: []
    }
  },
  computed: {
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    timeFormat() {
      return this.$store.state.serverSettings.timeFormat
    }
  },
  methods: {
    showFeed(feed) {
      this.selectedFeed = feed
      this.showFeedModal = true
    },
    deleteFeedClick(feed) {
      const payload = {
        message: this.$strings.MessageConfirmCloseFeed,
        callback: (confirmed) => {
          if (confirmed) {
            this.deleteFeed(feed)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    deleteFeed(feed) {
      this.processing = true
      this.$axios
        .$post(`/api/feeds/${feed.id}/close`)
        .then(() => {
          this.$toast.success(this.$strings.ToastRSSFeedCloseSuccess)
          this.show = false
          this.loadFeeds()
        })
        .catch((error) => {
          console.error('Failed to close RSS feed', error)
          this.$toast.error(this.$strings.ToastRSSFeedCloseFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    getEntityType(entityType) {
      if (entityType === 'libraryItem') return this.$strings.LabelItem
      else if (entityType === 'series') return this.$strings.LabelSeries
      else if (entityType === 'collection') return this.$strings.LabelCollection
      return this.$strings.LabelUnknown
    },
    coverUrl(feed) {
      if (!feed.coverPath) return `${this.$config.routerBasePath}/Logo.png`
      return `${this.$config.routerBasePath}${feed.feedUrl}/cover`
    },
    async loadFeeds() {
      const data = await this.$axios.$get(`/api/feeds`).catch((err) => {
        console.error('Failed to load RSS feeds', err)
        return null
      })
      if (!data) {
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        return
      }
      this.feeds = data.feeds
    },
    init() {
      this.loadFeeds()
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style scoped>
.rssFeedsTable {
  border-collapse: collapse;
  width: 100%;
  max-width: 100%;
  border: 1px solid #474747;
}

.rssFeedsTable tr:first-child {
  background-color: #272727;
}

.rssFeedsTable tr:not(:first-child) {
  background-color: #373838;
}

.rssFeedsTable tr:not(:first-child):nth-child(odd) {
  background-color: #2f2f2f;
}

.rssFeedsTable tr:hover:not(:first-child) {
  background-color: #474747;
}

.rssFeedsTable td {
  padding: 4px 8px;
}

.rssFeedsTable th {
  padding: 4px 8px;
  font-size: 0.75rem;
}
</style>
