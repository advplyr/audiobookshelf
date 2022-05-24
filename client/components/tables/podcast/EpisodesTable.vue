<template>
  <div class="w-full py-6">
    <div class="flex items-center mb-4">
      <p class="text-lg mb-0 font-semibold">Episodes</p>
      <div class="flex-grow" />
      <controls-episode-sort-select v-model="sortKey" :descending.sync="sortDesc" class="w-36 sm:w-44 md:w-48 h-9 ml-1 sm:ml-4" @change="changeSort" />
      <div v-if="userCanUpdate" class="w-12">
        <ui-icon-btn v-if="orderChanged" :loading="savingOrder" icon="save" bg-color="primary" class="ml-auto" @click="saveOrder" />
      </div>
    </div>
    <p v-if="!episodes.length" class="py-4 text-center text-lg">No Episodes</p>
    <template v-for="episode in episodes">
      <tables-podcast-episode-table-row :key="episode.id" :episode="episode" :library-item-id="libraryItem.id" class="item" @edit="editEpisode" />
    </template>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      sortKey: 'publishedAt',
      sortDesc: true
    }
  },
  computed: {
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    episodes() {
      return this.media.episodes || []
    }
  },
  methods: {
    editEpisode(episode) {
      this.$store.commit('setSelectedLibraryItem', this.libraryItem)
      this.$store.commit('globals/setSelectedEpisode', episode)
      this.$store.commit('globals/setShowEditPodcastEpisodeModal', true)
    }
  },
  mounted() {}
}
</script>

<style>
.episode-item {
  transition: all 0.4s ease;
}

.episode-enter-from,
.episode-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.episode-leave-active {
  position: absolute;
}
</style>