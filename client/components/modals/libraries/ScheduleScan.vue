<template>
  <div class="w-full h-full px-1 md:px-4 py-1 mb-4">
    <div class="flex items-center justify-between mb-4">
      <p class="text-base md:text-xl font-semibold">{{ $strings.HeaderScheduleLibraryScans }}</p>
      <ui-checkbox v-model="enableAutoScan" @input="toggleEnableAutoScan" :label="$strings.LabelEnable" medium checkbox-bg="bg" label-class="pl-2 text-base md:text-lg" />
    </div>
    <widgets-cron-expression-builder ref="cronExpressionBuilder" v-if="enableAutoScan" v-model="cronExpression" @input="updatedCron" />
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
      enableAutoScan: false
    }
  },
  computed: {},
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
    init() {
      this.cronExpression = this.library.settings.autoScanCronExpression
      this.enableAutoScan = !!this.cronExpression
    }
  },
  mounted() {
    this.init()
  }
}
</script>