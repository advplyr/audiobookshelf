<template>
  <modals-modal v-model="show" name="queue-items" :width="800" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">Player Queue</p>
      </div>
    </template>
    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden py-4" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <modals-player-queue-item-row v-for="(item, index) in playerQueueItems" :key="index" :item="item" :index="index" @play="playItem" @remove="removeItem" />
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    libraryItemId: String
  },
  data() {
    return {}
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
    playerQueueItems() {
      return this.$store.state.playerQueueItems || []
    }
  },
  methods: {
    playItem(item) {
      this.$eventBus.$emit('play-item', {
        libraryItemId: item.libraryItemId,
        episodeId: item.episodeId || null,
        queueItems: this.playerQueueItems
      })
      this.show = false
    },
    removeItem(item) {
      const updatedQueue = this.playerQueueItems.filter((i) => {
        if (!i.episodeId) return i.libraryItemId !== item.libraryItemId
        return i.libraryItemId !== item.libraryItemId || i.episodeId !== item.episodeId
      })
      this.$store.commit('setPlayerQueueItems', updatedQueue)
    }
  }
}
</script>