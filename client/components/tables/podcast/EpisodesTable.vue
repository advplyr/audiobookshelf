<template>
  <div class="w-full py-6">
    <p class="text-lg mb-0 font-semibold">Episodes</p>
    <p v-if="!episodes.length" class="py-4 text-center text-lg">
      No Episodes
    </p>
    <draggable v-model="episodesCopy" v-bind="dragOptions" class="list-group" handle=".drag-handle" draggable=".item" tag="div" @start="drag = true" @end="drag = false" @update="draggableUpdate">
      <transition-group type="transition" :name="!drag ? 'episode' : null">
        <template v-for="episode in episodesCopy">
          <tables-podcast-episode-table-row :key="episode.id" :is-dragging="drag" :episode="episode" :library-item-id="libraryItem.id" class="item" :class="drag ? '' : 'episode'" />
        </template>
      </transition-group>
    </draggable>
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
      drag: false,
      dragOptions: {
        animation: 200,
        group: 'description',
        ghostClass: 'ghost'
      },
      episodesCopy: []
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
    draggableUpdate() {
      var episodesUpdate = {
        episodes: this.episodesCopy.map((b) => b.id)
      }
      this.$axios
        .$patch(`/api/items/${this.libraryItem.id}/episodes`, episodesUpdate)
        .then((podcast) => {
          console.log('Podcast updated', podcast)
        })
        .catch((error) => {
          console.error('Failed to update podcast', error)
          this.$toast.error('Failed to save podcast episode order')
        })
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