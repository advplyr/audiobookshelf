<template>
  <div class="w-full h-full px-4 py-1 mb-4">
    <div class="flex items-center justify-between mb-4">
      <p class="text-lg">Schedule Automatic Library Scans</p>
      <ui-checkbox v-model="enableAutoScan" @input="toggleEnableAutoScan" label="Enable" checkbox-bg="bg" label-class="pl-2 text-base" />
    </div>
    <widgets-cron-expression-builder v-if="enableAutoScan" v-model="cronExpression" @input="updatedCron" />
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
    toggleEnableAutoScan(v) {
      if (!v) this.updatedCron(null)
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