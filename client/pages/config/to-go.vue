<template>
  <app-settings-content :header-text="$strings.HeaderToGo" class="!mb-4">
    <div class="max-w-3xl w-full my-6 mx-auto">
      <h2 class="text-2xl"> {{ $strings.HeaderCurrentProgress }} </h2>
      <div class="mb-8">
        <div v-if="libraryStats" class="flex lg:flex-row flex-wrap justify-between flex-col mt-4">
          <div class="w-full my-2">
            <div class="flex justify-between">
              <p class="text-2xl font-bold">{{ $elapsedPretty(listenedTime) }}</p>
              <div class="flex flex-col justify-end">
                <nuxt-link class="text-base text-white text-opacity-70 hover:underline self-end" :to="`/library/${currentLibraryId}/stats`">
                  {{ this.$getString('LabelTotal', [$elapsedPretty(libraryStats.totalDuration)]) }}
                </nuxt-link>
              </div>
            </div>
            <div class="w-full rounded-full h-3 bg-primary bg-opacity-50 overflow-hidden mt-2">
              <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * listenedTime) / libraryStats.totalDuration) + '%' }"></div>
            </div>
          </div>
        </div>

        <div v-if="libraryStats" class="flex lg:flex-row flex-wrap justify-between flex-col mt-8">
          <div class="w-full my-2">
            <div class="flex justify-between">
              <p class="text-2xl font-bold">{{ this.$getString('LabelItemsListened', [currentMediaProgress.length]) }}</p>
              <nuxt-link class="text-base text-white text-opacity-70 hover:underline self-end" :to="`/library/${currentLibraryId}/stats`">
                {{ this.$getString('LabelItemsTotal', [items.length]) }}
              </nuxt-link>
            </div>
            <div class="w-full rounded-full h-3 bg-primary bg-opacity-50 overflow-hidden mt-2">
              <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * currentMediaProgress.length) / items.length) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row justify-between gap-12">
        <div v-if="unfinishedStartedItems.length" class="w-full lg:w-1/2">
          <h2 class="text-2xl mb-2"> {{$strings.HeaderItemToContinue}} </h2>
          <table class="w-full">
            <tbody>
            <tr v-for="(item, index) in unfinishedStartedItems" :key="item.id" v-if="index < itemsToShow" :class="!item.isFinished ? '' : 'isFinished'">
              <td class="pr-4">
                <covers-preview-cover v-if="item.media.coverPath" :width="50" :src="$store.getters['globals/getLibraryItemCoverSrcById'](item.id, item.updatedAt)" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" />
                <div v-else class="bg-primary flex items-center justify-center text-center text-xs text-gray-400 p-1" :style="{ width: '50px', height: 50 * bookCoverAspectRatio + 'px' }">No Cover</div>
              </td>
              <td class="w-full">
                <nuxt-link :to="`/item/${item.id}`" class="hover:underline">
                  <p class="text-sm">{{ item.media.metadata.title || 'Unknown' }}</p>
                  <p v-if="item.displaySubtitle" class="text-white text-opacity-50 text-xs font-sans">{{ item.media.metadata.subtitle }}</p>
                </nuxt-link>
              </td>
              <td class="text-center pl-1 text-white/70">
                <p class="text-xs">{{ Math.floor(item.mediaProgress.progress * 100) }}%</p>
              </td>
            </tr>
            <tr v-if="itemsToShow < unfinishedStartedItems.length">
              <td colspan="3" class="text-center text-yellow-400 cursor-pointer" @click="itemsToShow += 6">Show more</td>
            </tr>
            </tbody>
          </table>
        </div>

        <div class="w-full" v-bind:class = "(unfinishedStartedItems.length)?'lg:w-1/2':''">
          <h2 class="text-2xl mb-2"> {{$strings.HeaderUnfinishedItems}} </h2>
          <table class="w-full">
            <tbody>
            <tr v-for="(item, index) in unfinishedItems" :key="item.id" v-if="index < topItemsToShow && index < unfinishedItems.length - bottomItemsToShow" :class="!item.isFinished ? '' : 'isFinished'">
              <td class="pr-4">
                <covers-preview-cover v-if="item.media.coverPath" :width="50" :src="$store.getters['globals/getLibraryItemCoverSrcById'](item.id, item.updatedAt)" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" />
                <div v-else class="bg-primary flex items-center justify-center text-center text-xs text-gray-400 p-1" :style="{ width: '50px', height: 50 * bookCoverAspectRatio + 'px' }">No Cover</div>
              </td>
              <td class="w-full">
                <nuxt-link :to="`/item/${item.id}`" class="hover:underline">
                  <p class="text-sm">{{ item.media.metadata.title || 'Unknown' }}</p>
                  <p v-if="item.displaySubtitle" class="text-white text-opacity-50 text-xs font-sans">{{ item.media.metadata.subtitle }}</p>
                </nuxt-link>
              </td>
              <td class="text-center text-white/70 whitespace-nowrap w-full">
                <p class="inline-block w-full text-xs pl-1">
                  {{ $elapsedPretty(item.media.duration) }}
                </p>
              </td>

            </tr>
            <tr v-if="topItemsToShow + bottomItemsToShow < unfinishedItems.length">
              <td colspan="3" class="text-center py-2">
                <span v-if="topItemsToShow < unfinishedItems.length - bottomItemsToShow" class="text-yellow-400 cursor-pointer" @click="loadMoreTopItems">Load More from Top</span>
                <span v-if="topItemsToShow < unfinishedItems.length - bottomItemsToShow && bottomItemsToShow < unfinishedItems.length - topItemsToShow" class="mx-4">|</span>
                <span v-if="bottomItemsToShow < unfinishedItems.length - topItemsToShow" class="text-yellow-400 cursor-pointer" @click="loadMoreBottomItems">Load More from Bottom</span>
              </td>
            </tr>
            <tr v-for="(item, index) in unfinishedItems" :key="item.id" v-if="index >= unfinishedItems.length - bottomItemsToShow && index >= topItemsToShow" :class="!item.isFinished ? '' : 'isFinished'">
              <td class="pr-4">
                <covers-preview-cover v-if="item.media.coverPath" :width="50" :src="$store.getters['globals/getLibraryItemCoverSrcById'](item.id, item.updatedAt)" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" />
                <div v-else class="bg-primary flex items-center justify-center text-center text-xs text-gray-400 p-1" :style="{ width: '50px', height: 50 * bookCoverAspectRatio + 'px' }">No Cover</div>
              </td>
              <td class="w-full">
                <nuxt-link :to="`/item/${item.id}`" class="hover:underline">
                  <p class="text-sm">{{ item.media.metadata.title || 'Unknown' }}</p>
                  <p v-if="item.displaySubtitle" class="text-white text-opacity-50 text-xs font-sans">{{ item.media.metadata.subtitle }}</p>
                </nuxt-link>
              </td>
              <td class="text-center text-white/70 whitespace-nowrap w-full">
                <p class="inline-block w-full text-xs pl-1">
                  {{ $elapsedPretty(item.media.duration) }}
                </p>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </app-settings-content>
</template>


<script>export default {
  asyncData({ redirect, store }) {
    if(store.getters['libraries/getCurrentLibraryMediaType'] !== 'book') {
      redirect(`/library/${store.state.libraries.currentLibraryId}`)
    }
    return {}
  },
  data() {
    return {
      items: null,
      libraryStats: null,
      itemsToShow: 7,
      topItemsToShow: 3,
      bottomItemsToShow: 3,
    }
  },
  watch: {
    currentLibraryId(newVal, oldVal) {
      if (newVal) {
        this.init()
        this.resetValues()
        if(this.getCurrentLibraryMediaType !== 'book') {
          this.$router.push(`/config`)
        }
      }
    }
  },
  computed: {
    isAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    user() {
      return this.$store.state.user.user
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    getCurrentLibraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
    },
    mediaProgress() {
      return [...this.user.mediaProgress].sort((a, b) => b.lastUpdate - a.lastUpdate);
    },
    currentMediaProgress() {
      if (this.items) {
        return this.mediaProgress.filter((mp) => {
          const itemId = mp.libraryItemId
          const episodeId = mp.episodeId
          const item = this.items.find(item => item.id === itemId)

          let episodeExists = false
          if (item) {
            // If there are episodes, check if the episodeId matches any episode.id
            if (item.media?.metadata?.episodes) {
              episodeExists = item.media.metadata.episodes.some(episode => episode.id === episodeId)
            } else {
              // If there are no episodes, we consider it valid if episodeId is null
              episodeExists = episodeId === null
            }
          }

          return item && episodeExists
        })
      } else {
        return []
      }
    },
    unfinishedStartedItems() {
      return this.currentMediaProgress
        .map((mp) => {
          const item = this.items.find(item => item.id === mp.libraryItemId);
          return { ...item, mediaProgress: mp };
        })
        .filter((item) => !item.mediaProgress.isFinished || item.mediaProgress.progress < 1)
        .sort((a, b) => b.mediaProgress.progress - a.mediaProgress.progress);
    },
    unfinishedItems() {
      if (this.items) {
        return this.items
          .filter((item) => {
            const progressItem = this.mediaProgress.find(mp => mp.libraryItemId === item.id);
            return !progressItem || progressItem.progress < 1;
          })
          .sort((a, b) => {
            const durationA = a.media?.duration || 0;
            const durationB = b.media?.duration || 0;
            return durationB - durationA;
          });

      } else {
        return [];
      }
    },
    listenedTime() {
      let listenedTime = 0
      if (this.items) {
        this.currentMediaProgress.forEach((lip) => {
          if (lip.isFinished) {
            listenedTime += lip.duration
          } else {
            listenedTime += lip.currentTime
          }
        })
      }
      return listenedTime
    }
  },
  methods: {
    async init() {
      this.items = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/items`).catch((err) => {
        console.error('Failed to load listening sessions', err)
        return []
      })
      this.items = this.items.results

      this.libraryStats = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/stats`).catch((err) => {
        console.error('Failed to get library stats', err)
        return []
      })
    },
    loadMoreTopItems() {
      const maxTopItems = this.unfinishedItems.length - this.bottomItemsToShow;
      this.topItemsToShow = Math.min(this.topItemsToShow + 3, maxTopItems);
    },
    loadMoreBottomItems() {
      const maxBottomItems = this.unfinishedItems.length - this.topItemsToShow;
      this.bottomItemsToShow = Math.min(this.bottomItemsToShow + 3, maxBottomItems);
    },
    resetValues() {
      this.itemsToShow = 7
      this.topItemsToShow = 3
      this.bottomItemsToShow = 3
    }
  },
  mounted() {
    this.init()
  }
}
</script>

