<template>
  <modals-modal v-model="show" name="queue-items" :width="800" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.HeaderPlayerQueue }}</p>
      </div>
    </template>
    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden py-4" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="pb-4 px-4 flex items-center">
          <p class="text-base text-gray-200">{{ $strings.HeaderPlayerQueue }}</p>
          <p class="text-base text-gray-400 px-4">{{ playerQueueItems.length }} Items</p>
          <div class="flex-grow" />
          <ui-checkbox v-model="playerQueueAutoPlay" label="Auto Play" medium checkbox-bg="primary" border-color="gray-600" label-class="pl-2 mb-px" />
        </div>
        <modals-player-queue-item-row v-for="(item, index) in playerQueueItems" :key="index" :item="item" :index="index" @play="playItem(index)" @remove="removeItem" />
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean
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
    playerQueueAutoPlay: {
      get() {
        return this.$store.state.playerQueueAutoPlay
      },
      set(val) {
        this.$store.commit('setPlayerQueueAutoPlay', val)
      }
    },
    playerQueueItems() {
      return this.$store.state.playerQueueItems || []
    }
  },
  methods: {
    playItem(index) {
      this.$eventBus.$emit('play-queue-item', {
        index
      })
      this.show = false
    },
    removeItem(item) {
      this.$store.commit('removeItemFromQueue', item)
    }
  }
}
</script>
