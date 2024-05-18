<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderRSSFeeds">
      <template #header-items>
        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides/rss_feeds" target="_blank" class="inline-flex">
            <span class="material-icons text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>
      </template>

      <div class="w-full py-2">
        <div class="flex -mb-px">
          <div
              class="w-1/2 h-8 rounded-tl-md relative border border-black-200 flex items-center justify-center cursor-pointer"
              :class="showOpenedFeedsView ? 'text-white bg-bg hover:bg-opacity-60 border-b-bg' : 'text-gray-400 hover:text-gray-300 bg-primary bg-opacity-70 hover:bg-opacity-60'"
              @click="showOpenedFeedsView = true">
            <p class="text-sm">{{$strings.HeaderOpenedRSSFeeds}}</p>
          </div>
          <div
              class="w-1/2 h-8 rounded-tr-md relative border border-black-200 flex items-center justify-center -ml-px cursor-pointer"
              :class="!showOpenedFeedsView ? 'text-white bg-bg hover:bg-opacity-60 border-b-bg' : 'text-gray-400 hover:text-gray-300 bg-primary bg-opacity-70 hover:bg-opacity-60'"
              @click="showOpenedFeedsView = false">
            <p class="text-sm">{{$strings.HeaderExternalFeedURLHealthChecker}}</p>
          </div>
        </div>
        <div class="px-2 py-4 md:p-4 border border-black-200 rounded-b-md mr-px" style="min-height: 280px">
          <template v-if="showOpenedFeedsView">
            <div v-if="feeds.length" class="block max-w-full pt-2">
              <form @submit.prevent="feedsSubmit" class="flex flex-grow">
                <ui-text-input v-model="feedsSearch" @input="feedsInputUpdate" type="search" :placeholder="$strings.PlaceholderSearchTitle" class="flex-grow mb-3 text-sm md:text-base" />
              </form>

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

                <tr v-for="feed in feedsList" :key="feed.id" class="cursor-pointer h-12" @click="showFeed(feed)">
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
                      <span class="material-icons text-2xl">check</span>
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
          </template>
          <template v-else>
            <div v-if="feedSubscriptions.length" class="block max-w-full">
              <div class="flex -mx-1 items-center mb-3">
                <div class="w-3/4 px-1">
                  <form @submit.prevent="feedSubscriptionsSubmit" class="flex flex-grow">
                    <ui-text-input v-model="feedSubscriptionsSearch" @input="feedSubscriptionsInputUpdate" type="search" :placeholder="$strings.PlaceholderSearchTitle" class="flex-grow text-sm md:text-base" />
                  </form>
                </div>
                <div class="flex-grow px-1">
                  <ui-checkbox v-model="feedSubscriptionsShowOnlyUnhealthy" :label="$strings.LabelFeedShowOnlyUnhealthy" checkbox-bg="primary" border-color="gray-600" label-class="pl-2 text-base font-semibold" />
                </div>
              </div>

              <table class="rssFeedsTable text-xs">
                <tr class="bg-primary bg-opacity-40 h-12">
                  <th class="w-16 min-w-16"></th>
                  <th class="w-48 max-w-64 min-w-24 text-left truncate">{{ $strings.LabelTitle }}/{{ $strings.LabelFeedURL }}</th>
                  <th class="w-24 min-w-16 text-left">{{ $strings.LabelFeedLastChecked }}</th>
                  <th class="w-24 min-w-16 text-left">{{ $strings.LabelFeedLastSuccessfulCheck }}</th>
                  <th class="w-16 min-w-16 text-left">{{ $strings.LabelFeedHealthy }}</th>
                  <th class="w-16 min-w-16 text-left">{{ $strings.LabelAutoDownloadEpisodes}}</th>
                  <th class="w-24 min-w-16 text-left">{{ $strings.LabelFeedNextAutomaticCheck }}</th>
                  <th class="w-16 text-center"></th>
                </tr>

                <tr v-for="feedSubscription in feedSubscriptionsList" :key="feedSubscription.id" class="cursor-pointer h-12">
                  <!--  -->
                  <td>
                    <covers-preview-cover v-if="feedSubscription?.metadata?.imageUrl" :width="50"
                                          :src="feedSubscription.metadata.imageUrl"
                                          :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false"/>
                    <img v-else :src="noCoverUrl" class="h-full w-full"/>
                  </td>
                  <!--  -->
                  <td class="w-48 max-w-64 min-w-24 text-left truncate">
                    <p class="truncate">{{ feedSubscription.metadata.title }}</p>
                    <p class="truncate text-xs text-gray-300">{{ feedSubscription.metadata.feedUrl }}</p>
                  </td>
                  <!--  -->
                  <td class="text-left">
                    <ui-tooltip v-if="feedSubscription.lastEpisodeCheck" direction="top"
                                :text="$formatDatetime(feedSubscription.lastEpisodeCheck, dateFormat, timeFormat)">
                      <p class="text-gray-200">{{ $dateDistanceFromNow(feedSubscription.lastEpisodeCheck) }}</p>
                    </ui-tooltip>
                  </td>
                  <!--  -->
                  <td class="text-left">
                    <ui-tooltip v-if="feedSubscription.metadata.lastSuccessfulFetchAt" direction="top"
                                :text="$formatDatetime(feedSubscription.metadata.lastSuccessfulFetchAt, dateFormat, timeFormat)">
                      <p class="text-gray-200">{{
                          $dateDistanceFromNow(feedSubscription.metadata.lastSuccessfulFetchAt)
                        }}</p>
                    </ui-tooltip>
                    <p class="text-gray-200" v-else>{{ $strings.MessageNoAvailable }}</p>
                  </td>
                  <!--  -->
                  <td class="text-center leading-none lg:table-cell">
                    <widgets-feed-healthy-indicator :value="!!feedSubscription.metadata.feedHealthy" />
                  </td>
                  <!--  -->
                  <td class="text-center leading-none lg:table-cell">
                    <ui-tooltip v-if="feedSubscription.autoDownloadEpisodes" direction="top"
                                :text="$strings.LabelEnabled">
                      <span class="material-icons text-2xl">check</span>
                    </ui-tooltip>
                    <ui-tooltip  v-else direction="top"
                                 :text="$strings.LabelDisabled">
                      <span class="material-icons text-2xl">close</span>
                    </ui-tooltip>
                  </td>
                  <!--  -->
                  <td class="text-left">
                    <ui-tooltip v-if="feedSubscription.autoDownloadEpisodes" direction="top"
                                :text="`${$strings.LabelCronExpression}: ${feedSubscription.autoDownloadSchedule}`">
                      <p class="text-gray-200">
                        {{ nextRun(feedSubscription.autoDownloadSchedule) }}
                      </p>
                    </ui-tooltip>
                  </td>
                  <!--  -->
                  <td>
                    <div class="w-full flex flex-row items-center justify-center">
                      <ui-tooltip direction="top"
                                  :text="$strings.ButtonCopyFeedURL">
                        <button class="inline-flex material-icons text-xl mx-1 mt-1 text-white/70 hover:text-white/100"
                                @click.stop="copyToClipboard(feedSubscription.metadata.feedUrl)">content_copy
                        </button>
                      </ui-tooltip>
                      <ui-tooltip direction="top" :text="$strings.ButtonForceReCheckFeed">
                        <button class="inline-flex material-icons text-xl mx-1 mt-1 text-white/70 hover:text-white/100"
                                @click.stop="forceRecheckFeed(feedSubscription)"
                                :disabled="feedSubscription.isLoading">
                          <span v-if="feedSubscription.isLoading" class="material-icons">hourglass_empty</span>
                          <span v-else class="material-icons">autorenew</span>
                        </button>
                      </ui-tooltip>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </template>
        </div>
      </div>
    </app-settings-content>
    <modals-rssfeed-view-feed-modal v-model="showFeedModal" :feed="selectedFeed"/>
  </div>
</template>

<script>
export default {
  data() {
    return {
      showOpenedFeedsView: true,
      showFeedModal: false,
      selectedFeed: null,
      feeds: [],
      feedSubscriptions: [],
      feedsSearch: null,
      feedsSearchTimeout: null,
      feedsSearchText: null,
      feedSubscriptionsSearch: null,
      feedSubscriptionsSearchTimeout: null,
      feedSubscriptionsSearchText: null,
      feedSubscriptionsShowOnlyUnhealthy: false,
    }
  },
  computed: {
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    timeFormat() {
      return this.$store.state.serverSettings.timeFormat
    },
    noCoverUrl() {
      return `${this.$config.routerBasePath}/Logo.png`
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    feedsList() {
      return this.feeds.filter((feed) => {
        if (!this.feedsSearchText) return true
        return feed?.meta?.title?.toLowerCase().includes(this.feedsSearchText) || feed?.slug?.toLowerCase().includes(this.feedsSearchText)
      })
    },
    feedSubscriptionsSorted() {
      return this.feedSubscriptionsShowOnlyUnhealthy
          ? this.feedSubscriptions.filter(feedSubscription => !feedSubscription.metadata.feedHealthy)
          : this.feedSubscriptions;
    },
    feedSubscriptionsList() {
      return this.feedSubscriptionsSorted.filter((feedSubscription) => {
        if (!this.feedSubscriptionsSearchText) return true
        if (this.feedSubscriptionsShowOnlyUnhealthy && feedSubscription?.metadata?.feedHealthy) return false
        return feedSubscription?.metadata?.title?.toLowerCase().includes(this.feedSubscriptionsSearchText) ||
          feedSubscription?.metadata?.feedUrl?.toLowerCase().includes(this.feedSubscriptionsSearchText)
      })
    },
  },
  methods: {
    feedsSubmit() {},
    feedsInputUpdate() {
      clearTimeout(this.feedsSearchTimeout)
      this.feedsSearchTimeout = setTimeout(() => {
        if (!this.feedsSearch || !this.feedsSearch.trim()) {
          this.feedsSearchText = ''
          return
        }
        this.feedsSearchText = this.feedsSearch.toLowerCase().trim()
      }, 500)
    },
    feedSubscriptionsSubmit() {},
    feedSubscriptionsInputUpdate() {
      clearTimeout(this.feedSubscriptionsSearchTimeout)
      this.feedSubscriptionsSearchTimeout = setTimeout(() => {
        if (!this.feedSubscriptionsSearch || !this.feedSubscriptionsSearch.trim()) {
          this.feedSubscriptionsSearchText = ''
          return
        }
        this.feedSubscriptionsSearchText = this.feedSubscriptionsSearch.toLowerCase().trim()
      }, 500)
    },
    showFeed(feed) {
      this.selectedFeed = feed
      this.showFeedModal = true
    },
    copyToClipboard(str) {
      this.$copyToClipboard(str, this)
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
      if (!feed.coverPath) return this.noCoverUrl
      return `${feed.feedUrl}/cover`
    },
    nextRun(cronExpression) {
      if (!cronExpression) return ''
      const parsed = this.$getNextScheduledDate(cronExpression)
      return this.$formatJsDatetime(parsed, this.$store.state.serverSettings.dateFormat, this.$store.state.serverSettings.timeFormat) || ''
    },
    async forceRecheckFeed(podcast) {
      podcast.isLoading = true
      let podcastResult;

      try {
        podcastResult = await this.$axios.$get(`/api/podcasts/${podcast.id}/check-feed-url`)

        if (!podcastResult?.feedHealthy) {
          this.$toast.error('Podcast feed url is not healthy')
        } else {
          this.$toast.success('Podcast feed url is healthy')
        }

        podcast.lastEpisodeCheck = Date.parse(podcastResult.lastEpisodeCheck)
        if (podcastResult.lastSuccessfulFetchAt) {
          podcast.metadata.lastSuccessfulFetchAt = Date.parse(podcastResult.lastSuccessfulFetchAt)
        }
        podcast.metadata.feedHealthy = podcastResult.feedHealthy
      } catch (error) {
        console.error('Podcast feed url is not healthy', error)
        this.$toast.error('Podcast feed url is not healthy')
        podcastResult = null
      } finally {
        podcast.isLoading = false
      }
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
    async loadPodcastsWithExternalFeedSubscriptions() {
      const data = await this.$axios.$get(`/api/podcasts/external-podcast-feeds-status`).catch((err) => {
        console.error('Failed to load podcasts with external feed subscriptions', err)
        return null
      })
      if (!data) {
        this.$toast.error('Failed to load podcasts with external feed subscriptions')
        return
      }

      this.feedSubscriptions = data.podcasts.map(podcast => ({...podcast, isLoading: false}));
    },
    init() {
      this.loadFeeds()
      this.loadPodcastsWithExternalFeedSubscriptions()
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
