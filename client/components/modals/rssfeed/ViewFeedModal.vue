<template>
  <modals-modal v-model="show" name="rss-feed-view-modal" :processing="processing" :width="700" :height="'unset'">
    <div ref="wrapper" class="px-8 py-6 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div v-if="feed" class="w-full">
        <p class="text-lg font-semibold mb-4">{{ $strings.HeaderRSSFeedGeneral }}</p>

        <div class="w-full relative">
          <ui-text-input :value="feedUrl" readonly show-copy />
        </div>

        <div v-if="feed.meta" class="mt-5">
          <div class="flex py-0.5">
            <div class="w-48">
              <span class="text-white/60 uppercase text-sm">{{ $strings.LabelRSSFeedPreventIndexing }}</span>
            </div>
            <div>{{ feed.meta.preventIndexing ? 'Yes' : 'No' }}</div>
          </div>
          <div v-if="feed.meta.ownerName" class="flex py-0.5">
            <div class="w-48">
              <span class="text-white/60 uppercase text-sm">{{ $strings.LabelRSSFeedCustomOwnerName }}</span>
            </div>
            <div>{{ feed.meta.ownerName }}</div>
          </div>
          <div v-if="feed.meta.ownerEmail" class="flex py-0.5">
            <div class="w-48">
              <span class="text-white/60 uppercase text-sm">{{ $strings.LabelRSSFeedCustomOwnerEmail }}</span>
            </div>
            <div>{{ feed.meta.ownerEmail }}</div>
          </div>
        </div>
        <!--  -->
        <div class="episodesTable mt-2">
          <div class="bg-primary/40 h-12 header">
            {{ $strings.LabelEpisodeTitle }}
          </div>
          <div class="scroller">
            <div v-for="episode in feed.episodes" :key="episode.id" class="h-8 text-xs truncate">
              {{ episode.title }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    feed: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      processing: false
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    _feed() {
      return this.feed || {}
    },
    feedUrl() {
      return this.feed ? `${window.origin}${this.$config.routerBasePath}${this.feed.feedUrl}` : ''
    }
  }
}
</script>

<style scoped>
.episodesTable {
  width: 100%;
  max-width: 100%;
  border: 1px solid #474747;
  display: flex;
  flex-direction: column;
}

.episodesTable div.header {
  background-color: #272727;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 4px 8px;
}

.episodesTable .scroller {
  display: flex;
  flex-direction: column;
  max-height: 250px;
  overflow-x: hidden;
  overflow-y: scroll;
}

.episodesTable .scroller div {
  background-color: #373838;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 32px;
  flex: 0 0 32px;
}

.episodesTable .scroller div:nth-child(even) {
  background-color: #2f2f2f;
}
</style>

