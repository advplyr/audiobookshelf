<template>
  <div class="w-full h-10 relative">
    <div id="toolbar" class="absolute top-0 left-0 w-full h-full z-10 flex items-center px-8">
      <!-- <p>Order By: {{ settings.orderBy }}</p>
      <p class="px-4">Desc: {{ settings.orderDesc ? 'Desc' : 'Asc' }}</p> -->
      <p class="font-book">{{ numShowing }} Audiobooks</p>
      <div class="flex-grow" />
      <controls-filter-select v-model="settings.filterBy" class="w-28 h-7.5" @change="updateFilter" />
      <span class="px-4 text-sm">by</span>
      <controls-order-select v-model="settings.orderBy" :descending.sync="settings.orderDesc" class="w-40 h-7.5" @change="updateOrder" />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      settings: {}
    }
  },
  computed: {
    numShowing() {
      return this.$store.getters['audiobooks/getFiltered']().length
    }
  },
  methods: {
    updateOrder() {
      this.saveSettings()
    },
    updateFilter() {
      this.saveSettings()
    },
    saveSettings() {
      // Send to server
      this.$store.commit('settings/setSettings', this.settings)
    },
    init() {
      this.settings = { ...this.$store.state.settings.settings }
    }
  },
  mounted() {
    this.init()
  }
}
</script>


<style>
#toolbar {
  box-shadow: 0px 8px 8px #111111aa;
}
</style>