<template>
  <modals-modal v-model="show" name="edit-library" :width="700" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div class="absolute -top-10 left-0 z-10 w-full flex">
      <template v-for="tab in tabs">
        <div :key="tab.id" class="w-28 rounded-t-lg flex items-center justify-center mr-1 cursor-pointer hover:bg-bg font-book border-t border-l border-r border-black-300 tab text-xs sm:text-base" :class="selectedTab === tab.id ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab(tab.id)">{{ tab.title }}</div>
      </template>
    </div>

    <div class="px-4 w-full text-sm pt-6 pb-20 rounded-b-lg rounded-tr-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <component v-if="libraryCopy && show" :is="tabName" :is-new="!library" :library="libraryCopy" :processing.sync="processing" @update="updateLibrary" @close="show = false" />

      <div class="absolute bottom-0 left-0 w-full px-4 py-4 border-t border-white border-opacity-10">
        <div class="flex justify-end">
          <ui-btn @click="submit">{{ buttonText }}</ui-btn>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    library: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      processing: false,
      selectedTab: 'details',
      tabs: [
        {
          id: 'details',
          title: 'Details',
          component: 'modals-libraries-edit-library'
        },
        {
          id: 'settings',
          title: 'Settings',
          component: 'modals-libraries-library-settings'
        }
        // {
        //   id: 'schedule',
        //   title: 'Schedule',
        //   component: 'modals-libraries-schedule-scan'
        // }
      ],
      libraryCopy: null
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
    title() {
      return this.library ? 'Update Library' : 'New Library'
    },
    buttonText() {
      return this.library ? 'Update Library' : 'Create New Library'
    },
    tabName() {
      var _tab = this.tabs.find((t) => t.id === this.selectedTab)
      return _tab ? _tab.component : ''
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  methods: {
    selectTab(tab) {
      this.selectedTab = tab
    },
    updateLibrary(library) {
      this.mapLibraryToCopy(library)
      console.log('Updated library', this.libraryCopy)
    },
    getNewLibraryData() {
      return {
        name: '',
        provider: 'google',
        folders: [],
        icon: 'database',
        mediaType: 'book',
        settings: {
          coverAspectRatio: this.$constants.BookCoverAspectRatio.SQUARE,
          disableWatcher: false,
          skipMatchingMediaWithAsin: false,
          skipMatchingMediaWithIsbn: false,
          autoScanCronExpression: null
        }
      }
    },
    init() {
      this.selectedTab = 'details'
      this.libraryCopy = this.getNewLibraryData()
      if (this.library) {
        this.mapLibraryToCopy(this.library)
      }
    },
    mapLibraryToCopy(library) {
      for (const key in this.libraryCopy) {
        if (library[key] !== undefined) {
          if (key === 'folders') {
            this.libraryCopy.folders = library.folders.map((f) => ({ ...f }))
          } else if (key === 'settings') {
            for (const settingKey in library.settings) {
              this.libraryCopy.settings[settingKey] = library.settings[settingKey]
            }
          } else {
            this.libraryCopy[key] = library[key]
          }
        }
      }
    },
    validate() {
      if (!this.libraryCopy.name) {
        this.$toast.error('Library must have a name')
        return false
      }
      if (!this.libraryCopy.folders.length) {
        this.$toast.error('Library must have at least 1 path')
        return false
      }

      return true
    },
    submit() {
      if (!this.validate()) return

      if (this.library) {
        this.submitUpdateLibrary()
      } else {
        this.submitCreateLibrary()
      }
    },
    getLibraryUpdatePayload() {
      var updatePayload = {}
      for (const key in this.libraryCopy) {
        if (key === 'folders') {
          if (this.libraryCopy.folders.map((f) => f.fullPath).join(',') !== this.library.folders.map((f) => f.fullPath).join(',')) {
            updatePayload.folders = [...this.libraryCopy.folders]
          }
        } else if (key === 'settings') {
          for (const settingsKey in this.libraryCopy.settings) {
            if (this.libraryCopy.settings[settingsKey] !== this.library.settings[settingsKey]) {
              if (!updatePayload.settings) updatePayload.settings = {}
              updatePayload.settings[settingsKey] = this.libraryCopy.settings[settingsKey]
            }
          }
        } else if (key !== 'mediaType' && this.libraryCopy[key] !== this.library[key]) {
          updatePayload[key] = this.libraryCopy[key]
        }
      }
      return updatePayload
    },
    submitUpdateLibrary() {
      var newLibraryPayload = this.getLibraryUpdatePayload()
      if (!Object.keys(newLibraryPayload).length) {
        this.$toast.info('No updates are necessary')
        return
      }

      this.processing = true
      this.$axios
        .$patch(`/api/libraries/${this.library.id}`, newLibraryPayload)
        .then((res) => {
          this.processing = false
          this.show = false
          this.$toast.success(`Library "${res.name}" updated successfully`)
        })
        .catch((error) => {
          console.error(error)
          if (error.response && error.response.data) {
            this.$toast.error(error.response.data)
          } else {
            this.$toast.error('Failed to update library')
          }
          this.processing = false
        })
    },
    submitCreateLibrary() {
      this.processing = true
      this.$axios
        .$post('/api/libraries', this.libraryCopy)
        .then((res) => {
          this.processing = false
          this.show = false
          this.$toast.success(`Library "${res.name}" created successfully`)
          if (!this.$store.state.libraries.currentLibraryId) {
            console.log('Setting initially library id', res.id)
            // First library added
            this.$store.dispatch('libraries/fetch', res.id)
          }
        })
        .catch((error) => {
          console.error(error)
          if (error.response && error.response.data) {
            this.$toast.error(error.response.data)
          } else {
            this.$toast.error('Failed to create library')
          }
          this.processing = false
        })
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>

<style scoped>
.tab {
  height: 40px;
}
.tab.tab-selected {
  height: 41px;
}
</style>