<template>
  <modals-modal v-model="show" name="edit-library" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-xl md:text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div class="absolute -top-10 left-0 z-10 w-full flex">
      <template v-for="tab in tabs">
        <div :key="tab.id" class="w-28 rounded-t-lg flex items-center justify-center mr-1 cursor-pointer hover:bg-bg border-t border-l border-r border-black-300 tab text-xs sm:text-base" :class="selectedTab === tab.id ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab(tab.id)">{{ tab.title }}</div>
      </template>
    </div>

    <div class="px-2 md:px-4 w-full text-sm pt-2 md:pt-6 pb-20 rounded-b-lg rounded-tr-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <component v-if="libraryCopy && show" ref="tabComponent" :is="tabName" :is-new="!library" :library="libraryCopy" :library-id="libraryId" :processing.sync="processing" @update="updateLibrary" @close="show = false" />

      <div v-show="selectedTab !== 'tools'" class="absolute bottom-0 left-0 w-full px-4 py-4 border-t border-white/10">
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
      return this.library ? this.$strings.HeaderUpdateLibrary : this.$strings.HeaderNewLibrary
    },
    buttonText() {
      return this.library ? this.$strings.ButtonSave : this.$strings.ButtonCreate
    },
    mediaType() {
      return this.libraryCopy?.mediaType
    },
    libraryId() {
      return this.library?.id
    },
    tabs() {
      return [
        {
          id: 'details',
          title: this.$strings.HeaderDetails,
          component: 'modals-libraries-edit-library'
        },
        {
          id: 'settings',
          title: this.$strings.HeaderSettings,
          component: 'modals-libraries-library-settings'
        },
        {
          id: 'scanner',
          title: this.$strings.HeaderSettingsScanner,
          component: 'modals-libraries-library-scanner-settings'
        },
        {
          id: 'schedule',
          title: this.$strings.HeaderSchedule,
          component: 'modals-libraries-schedule-scan'
        },
        {
          id: 'tools',
          title: this.$strings.HeaderTools,
          component: 'modals-libraries-library-tools'
        }
      ].filter((tab) => {
        // Do not show tools tab for new libraries
        if (tab.id === 'tools' && !this.library) return false
        return tab.id !== 'scanner' || this.mediaType === 'book'
      })
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
          autoScanCronExpression: null,
          hideSingleBookSeries: false,
          onlyShowLaterBooksInContinueSeries: false,
          metadataPrecedence: ['folderStructure', 'audioMetatags', 'nfoFile', 'txtFiles', 'opfFile', 'absMetadata'],
          markAsFinishedPercentComplete: null,
          markAsFinishedTimeRemaining: 10
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
            this.libraryCopy.folders = library.folders.map((f) => ({ ...f })).filter((f) => !!f.fullPath?.trim())
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
        this.$toast.error(this.$strings.ToastNameRequired)
        return false
      }
      if (!this.libraryCopy.folders.length) {
        this.$toast.error(this.$strings.ToastMustHaveAtLeastOnePath)
        return false
      }

      return true
    },
    submit() {
      // If custom expression input is focused then unfocus it instead of submitting
      if (this.$refs.tabComponent && this.$refs.tabComponent.checkBlurExpressionInput) {
        if (this.$refs.tabComponent.checkBlurExpressionInput()) {
          return
        }
      }

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
        this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
        return
      }

      this.processing = true
      this.$axios
        .$patch(`/api/libraries/${this.library.id}`, newLibraryPayload)
        .then((res) => {
          this.processing = false
          this.show = false
          this.$toast.success(this.$getString('ToastLibraryUpdateSuccess', [res.name]))
        })
        .catch((error) => {
          console.error(error)
          if (error.response && error.response.data) {
            this.$toast.error(error.response.data)
          } else {
            this.$toast.error(this.$strings.ToastFailedToUpdate)
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
          this.$toast.success(this.$getString('ToastLibraryCreateSuccess', [res.name]))
          if (!this.$store.state.libraries.currentLibraryId) {
            // First library added
            this.$store.dispatch('libraries/fetch', res.id)
          }
        })
        .catch((error) => {
          console.error(error)
          if (error.response && error.response.data) {
            this.$toast.error(error.response.data)
          } else {
            this.$toast.error(this.$strings.ToastLibraryCreateFailed)
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
