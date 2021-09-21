<template>
  <div class="w-full h-10 relative">
    <div id="toolbar" class="absolute top-0 left-0 w-full h-full z-20 flex items-center px-8">
      <p class="font-book">{{ numShowing }} Audiobooks</p>
      <div class="flex-grow" />

      <ui-text-input v-model="_keywordFilter" placeholder="Keyword Filter" :padding-y="1.5" class="text-xs w-40" />

      <controls-filter-select v-model="settings.filterBy" class="w-48 h-7.5 ml-4" @change="updateFilter" />

      <controls-order-select v-model="settings.orderBy" :descending.sync="settings.orderDesc" class="w-48 h-7.5 ml-4" @change="updateOrder" />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      settings: {},
      hasInit: false
    }
  },
  computed: {
    numShowing() {
      return this.$store.getters['audiobooks/getFiltered']().length
    },
    _keywordFilter: {
      get() {
        return this.$store.state.audiobooks.keywordFilter
      },
      set(val) {
        this.$store.commit('audiobooks/setKeywordFilter', val)
      }
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
      this.$store.dispatch('user/updateUserSettings', this.settings)
    },
    init() {
      this.settings = { ...this.$store.state.user.settings }
    },
    settingsUpdated(settings) {
      for (const key in settings) {
        this.settings[key] = settings[key]
      }
    }
  },
  mounted() {
    this.init()
    this.$store.commit('user/addSettingsListener', { id: 'bookshelftoolbar', meth: this.settingsUpdated })
  },
  beforeDestroy() {
    this.$store.commit('user/removeSettingsListener', 'bookshelftoolbar')
  }
}
</script>


<style>
#toolbar {
  box-shadow: 0px 8px 8px #111111aa;
}
</style>