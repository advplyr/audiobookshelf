<template>
  <div ref="wrapper" role="dialog" aria-modal="true" class="hidden absolute top-0 left-0 w-full h-full bg-black/50 rounded-lg items-center justify-center" style="z-index: 61" @click="clickClose">
    <button type="button" class="absolute top-3 right-3 md:top-5 md:right-5 h-8 w-8 md:h-12 md:w-12 flex items-center justify-center cursor-pointer text-white hover:text-gray-300" aria-label="Close modal">
      <span class="material-symbols text-2xl md:text-4xl">close</span>
    </button>
    <div ref="content" class="text-white">
      <form v-if="selectedSeries" @submit.prevent="submitSeriesForm">
        <div class="bg-bg rounded-lg px-2 py-6 sm:p-6 md:p-8" @click.stop>
          <div class="flex">
            <div class="grow p-1 min-w-48 sm:min-w-64 md:min-w-80">
              <ui-input-dropdown ref="newSeriesSelect" v-model="selectedSeries.name" :items="existingSeriesNames" :disabled="!isNewSeries" :label="$strings.LabelSeriesName" @input="seriesNameInputHandler" />
            </div>
            <div class="w-24 sm:w-28 md:w-40 p-1">
              <ui-text-input-with-label ref="sequenceInput" v-model="selectedSeries.sequence" :label="$strings.LabelSequence" />
            </div>
          </div>
          <div class="flex mt-2">
            <div class="grow p-1">
              <div class="flex items-center">
                <ui-asin-input ref="asinInput" v-model="seriesAsin" :label="$strings.LabelSeriesAsin" :extracted-message="$strings.MessageAsinExtractedFromUrl" :valid-message="$strings.MessageValidAsinFormat" :invalid-message="$strings.MessageInvalidAsin" class="flex-grow" />
                <ui-tooltip :text="$strings.MessageAsinCheck" direction="top" class="ml-2 mt-5">
                  <span class="material-symbols text-gray-400 hover:text-white cursor-help" style="font-size: 1.1rem">help</span>
                </ui-tooltip>
              </div>
            </div>
          </div>
          <div v-if="error" class="text-error text-sm mt-2 p-1">{{ error }}</div>
          <div class="flex justify-end mt-2 p-1">
            <ui-btn type="submit">{{ $strings.ButtonSubmit }}</ui-btn>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: Boolean,
    selectedSeries: {
      type: Object,
      default: () => {}
    },
    existingSeriesNames: {
      type: Array,
      default: () => []
    },
    originalSeriesSequence: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      el: null,
      content: null,
      error: null,
      seriesAsin: ''
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.$nextTick(this.setShow)
      } else {
        this.setHide()
      }
    },
    selectedSeries: {
      handler(newVal) {
        if (!this.show) return
        this.seriesAsin = newVal?.audibleSeriesAsin || ''
      },
      deep: true
    },
    // Watch for series name changes to auto-populate ASIN when selecting existing series
    'selectedSeries.name': {
      async handler(newName) {
        if (!this.show || !newName || !this.isNewSeries) return
        // Check if this matches an existing series in the library
        await this.fetchSeriesAsinByName(newName)
      }
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
    isNewSeries() {
      if (!this.selectedSeries || !this.selectedSeries.id) return false
      return this.selectedSeries.id.startsWith('new')
    }
  },
  methods: {
    seriesNameInputHandler() {
      if (this.$refs.sequenceInput) {
        this.$refs.sequenceInput.setFocus()
      }
    },
    async fetchSeriesAsinByName(seriesName) {
      try {
        const libraryId = this.$store.state.libraries.currentLibraryId
        const series = this.$store.state.libraries.filterData?.series || []
        const matchingSeries = series.find((se) => se.name.toLowerCase() === seriesName.toLowerCase())
        if (!matchingSeries) return

        // Fetch full series data to get ASIN
        const fullSeries = await this.$axios.$get(`/api/libraries/${libraryId}/series/${matchingSeries.id}`)
        if (fullSeries?.audibleSeriesAsin) {
          this.seriesAsin = fullSeries.audibleSeriesAsin
        }
      } catch (error) {
        console.error('Failed to fetch series ASIN:', error)
      }
    },
    setInputFocus() {
      if (this.isNewSeries) {
        // Focus on series input if new series
        if (this.$refs.newSeriesSelect) {
          this.$refs.newSeriesSelect.setFocus()
        }
      } else {
        // Focus on sequence input if existing series
        if (this.$refs.sequenceInput) {
          this.$refs.sequenceInput.setFocus()
        }
      }
    },
    submitSeriesForm() {
      this.error = null

      if (this.$refs.newSeriesSelect) {
        this.$refs.newSeriesSelect.blur()
      }

      if (this.selectedSeries.sequence !== this.originalSeriesSequence && this.selectedSeries.sequence.includes(' ')) {
        this.error = this.$strings.MessageSeriesSequenceCannotContainSpaces
        return
      }

      // Validate ASIN format if provided
      if (this.seriesAsin && this.seriesAsin.trim()) {
        const asin = this.seriesAsin.trim().toUpperCase()
        if (!/^[A-Z0-9]{10}$/.test(asin)) {
          this.error = this.$strings.MessageInvalidAsin
          return
        }
        this.seriesAsin = asin
      }

      // Pass ASIN along with submit
      this.$emit('submit', { audibleSeriesAsin: this.seriesAsin || null })
    },
    clickClose() {
      this.show = false
    },
    hotkey(action) {
      if (action === this.$hotkeys.Modal.CLOSE) {
        this.show = false
      }
    },
    setShow() {
      this.error = null
      // Load existing ASIN from the series if it exists
      this.seriesAsin = this.selectedSeries?.audibleSeriesAsin || ''

      if (!this.el || !this.content) {
        this.init()
      }
      if (!this.el || !this.content) {
        return
      }

      document.body.appendChild(this.el)
      setTimeout(() => {
        this.content.style.transform = 'scale(1)'
      }, 10)

      this.$store.commit('setInnerModalOpen', true)
      this.$eventBus.$on('modal-hotkey', this.hotkey)

      this.setInputFocus()
    },
    setHide() {
      if (this.content) this.content.style.transform = 'scale(0)'
      if (this.el) this.el.remove()

      this.$store.commit('setInnerModalOpen', false)
      this.$eventBus.$off('modal-hotkey', this.hotkey)
    },
    init() {
      this.el = this.$refs.wrapper
      this.content = this.$refs.content
      if (this.content && this.el) {
        this.el.classList.remove('hidden')
        this.el.classList.add('flex')
        this.content.style.transform = 'scale(0)'
        this.content.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        this.el.style.opacity = 1
        this.el.remove()
      }
    }
  },
  mounted() {}
}
</script>
