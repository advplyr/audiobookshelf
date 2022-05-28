<template>
  <div ref="wrapper" class="hidden absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 rounded-lg items-center justify-center" style="z-index: 51" @click="clickClose">
    <div class="absolute top-5 right-5 h-12 w-12 flex items-center justify-center cursor-pointer text-white hover:text-gray-300">
      <span class="material-icons text-4xl">close</span>
    </div>
    <div ref="content" class="text-white">
      <form v-if="selectedSeries" @submit.prevent="submitSeriesForm">
        <div class="bg-bg rounded-lg p-8" @click.stop>
          <div class="flex">
            <div class="flex-grow p-1 min-w-80">
              <ui-input-dropdown ref="newSeriesSelect" v-model="selectedSeries.name" :items="existingSeriesNames" :disabled="!selectedSeries.id.startsWith('new')" label="Series Name" />
            </div>
            <div class="w-40 p-1">
              <ui-text-input-with-label v-model="selectedSeries.sequence" label="Sequence" />
            </div>
          </div>
          <div class="flex justify-end mt-2 p-1">
            <ui-btn type="submit">Save</ui-btn>
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
    }
  },
  methods: {
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
      document.documentElement.classList.add('modal-open')

      this.$store.commit('setInnerModalOpen', true)
      this.$eventBus.$on('modal-hotkey', this.hotkey)
    },
    setHide() {
      if (this.content) this.content.style.transform = 'scale(0)'
      if (this.el) this.el.remove()
      document.documentElement.classList.remove('modal-open')

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