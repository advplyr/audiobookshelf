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
    <draggable v-model="episodesCopy" v-bind="dragOptions" class="list-group" handle=".drag-handle" draggable=".item" tag="div" @start="drag = true" @end="drag = false" @update="draggableUpdate">
      <transition-group type="transition" :name="!drag ? 'episode' : null">
        <template v-for="episode in episodesCopy">
          <tables-podcast-episode-table-row :key="episode.id" :is-dragging="drag" :episode="episode" :library-item-id="libraryItem.id" class="item" :class="drag ? '' : 'episode'" @edit="editEpisode" />
        </template>
      </transition-group>
    </draggable>

    <modals-podcast-edit-episode v-model="showEditEpisodeModal" :library-item="libraryItem" :episode="selectedEpisode" />
  </div>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      sortKey: 'index',
      sortDesc: true,
      drag: false,
      episodesCopy: [],
      selectedEpisode: null,
      showEditEpisodeModal: false,
      orderChanged: false,
      savingOrder: false
    }
  },
  watch: {
    libraryItem: {
      handler(newVal) {
        this.init()
      }
    }
  },
  computed: {
    dragOptions() {
      return {
        animation: 200,
        group: 'description',
        ghostClass: 'ghost',
        disabled: !this.userCanUpdate
      }
    },
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
    changeSort() {
      this.episodesCopy.sort((a, b) => {
        if (this.sortDesc) {
          return String(b[this.sortKey]).localeCompare(String(a[this.sortKey]), undefined, { numeric: true, sensitivity: 'base' })
        }
        return String(a[this.sortKey]).localeCompare(String(b[this.sortKey]), undefined, { numeric: true, sensitivity: 'base' })
      })

      this.orderChanged = this.checkHasOrderChanged()
    },
    checkHasOrderChanged() {
      for (let i = 0; i < this.episodesCopy.length; i++) {
        var epc = this.episodesCopy[i]
        var ep = this.episodes[i]
        if (epc.index != ep.index) {
          return true
        }
      }
      return false
    },
    editEpisode(episode) {
      this.selectedEpisode = episode
      this.showEditEpisodeModal = true
    },
    draggableUpdate() {
      this.orderChanged = this.checkHasOrderChanged()
    },
    async saveOrder() {
      if (!this.userCanUpdate) return

      this.savingOrder = true

      var episodesUpdate = {
        episodes: this.episodesCopy.map((b) => b.id)
      }
      await this.$axios
        .$patch(`/api/items/${this.libraryItem.id}/episodes`, episodesUpdate)
        .then((podcast) => {
          console.log('Podcast updated', podcast)
          this.$toast.success('Saved episode order')
          this.orderChanged = false
        })
        .catch((error) => {
          console.error('Failed to update podcast', error)
          this.$toast.error('Failed to save podcast episode order')
        })
      this.savingOrder = false
    },
    init() {
      this.episodesCopy = this.episodes.map((ep) => {
        return {
          ...ep
        }
      })
    }
  },
  mounted() {
    this.init()
  }
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