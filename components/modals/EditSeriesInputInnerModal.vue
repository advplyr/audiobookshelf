<template>
  <div ref="wrapper" class="hidden absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 rounded-lg items-center justify-center" style="z-index: 61" @click="clickClose">
    <div class="absolute top-3 right-3 md:top-5 md:right-5 h-8 w-8 md:h-12 md:w-12 flex items-center justify-center cursor-pointer text-white hover:text-gray-300">
      <span class="material-symbols text-2xl md:text-4xl">close</span>
    </div>
    <div ref="content" class="text-white">
      <form v-if="selectedSeries" @submit.prevent="submitSeriesForm">
        <div class="bg-bg rounded-lg px-2 py-6 sm:p-6 md:p-8" @click.stop>
          <div class="flex">
            <div class="flex-grow p-1 min-w-48 sm:min-w-64 md:min-w-80">
              <ui-input-dropdown ref="newSeriesSelect" v-model="selectedSeries.name" :items="existingSeriesNames" :disabled="!isNewSeries" :label="$strings.LabelSeriesName" @input="seriesNameInputHandler" />
            </div>
            <div class="w-24 sm:w-28 md:w-40 p-1">
              <ui-text-input-with-label ref="sequenceInput" v-model="selectedSeries.sequence" :label="$strings.LabelSequence" />
            </div>
          </div>
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
    }
  },
  data() {
    return {
      el: null,
      content: null
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.$nextTick(this.setShow)
      } else {
        this.setHide()
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
      if (this.$refs.newSeriesSelect) {
        this.$refs.newSeriesSelect.blur()
      }

      this.$emit('submit')
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
