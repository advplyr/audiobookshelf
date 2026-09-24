<template>
  <div class="w-full h-full px-1 md:px-4 py-1 mb-4">
    <div class="flex items-center justify-between mb-4">
      <p class="text-base md:text-xl font-semibold">{{ $strings.HeaderScheduleLibraryScans }}</p>
      <ui-checkbox v-model="enableAutoScan" @input="toggleEnableAutoScan" :label="$strings.LabelEnable" medium checkbox-bg="bg" label-class="pl-2 text-base md:text-lg" />
    </div>
    <div v-if="enableAutoScan">
      <widgets-cron-expression-builder ref="cronExpressionBuilder" v-model="cronExpression" @input="updatedCron" />
      <div class="mt-4">
        <ui-checkbox v-model="matchAfterScan" @input="updateMatchAfterScan" :label="$strings.LabelMatchAfterScan" medium checkbox-bg="bg" label-class="pl-2 text-base" />
      </div>
      <div class="mt-4" v-if="matchAfterScan">
        <label class="px-1 text-sm font-semibold">{{ $strings.LabelMatchMinConfidence }}</label>
        <ui-range-input v-model.number="matchMinConfidencePercentage" :min="0" :max="100" :step="1" />
      </div>
    </div>
    <div v-else>
      <p class="text-yellow-400 text-base">{{ $strings.MessageScheduleLibraryScanNote }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    library: {
      type: Object,
      default: () => null
    },
    processing: Boolean
  },
  data() {
    return {
      cronExpression: null,
      enableAutoScan: false,
      matchAfterScan: false,
      matchMinConfidence: 0
    }
  },
  computed: {
    matchMinConfidencePercentage: {
      get() {
        return this.matchMinConfidence * 100
      },
      set(val) {
        this.matchMinConfidence = val / 100
        this.updateMatchMinConfidence()
      }
    }
  },
  methods: {
    checkBlurExpressionInput() {
      // returns true if advanced cron input is focused
      if (!this.$refs.cronExpressionBuilder) return false
      return this.$refs.cronExpressionBuilder.checkBlurExpressionInput()
    },
    toggleEnableAutoScan(v) {
      if (!v) this.updatedCron(null)
      else if (!this.cronExpression) {
        this.cronExpression = '0 0 * * 1'
        this.updatedCron(this.cronExpression)
      }
    },
    updatedCron(expression) {
      this.$emit('update', {
        settings: {
          autoScanCronExpression: expression
        }
      })
    },
    updateMatchAfterScan(value) {
      this.$emit('update', {
        settings: {
          matchAfterScan: value
        }
      })
    },
    updateMatchMinConfidence() {
      this.$emit('update', {
        settings: {
          matchMinConfidence: this.matchMinConfidence
        }
      })
    },
    init() {
      this.cronExpression = this.library.settings.autoScanCronExpression
      this.enableAutoScan = !!this.cronExpression
      this.matchAfterScan = this.library.settings.matchAfterScan
      this.matchMinConfidence = this.library.settings.matchMinConfidence || 0
    }
  },
  mounted() {
    this.init()
  }
}
</script>