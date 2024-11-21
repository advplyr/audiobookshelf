<template>
  <modals-modal v-model="show" name="backup-scheduler" :width="700" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.HeaderSetBackupSchedule }}</p>
      </div>
    </template>
    <div v-if="show && newCronExpression" class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <widgets-cron-expression-builder ref="expressionBuilder" v-model="newCronExpression" @input="expressionUpdated" />

      <div class="flex items-center justify-end">
        <ui-btn :disabled="!isUpdated" @click="submit">{{ isUpdated ? $strings.ButtonSave : $strings.MessageNoUpdatesWereNecessary }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    cronExpression: {
      type: String,
      default: '* * * * *'
    }
  },
  data() {
    return {
      processing: false,
      newCronExpression: null,
      isUpdated: false
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) {
          this.init()
        }
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
    expressionUpdated() {
      this.isUpdated = this.newCronExpression !== this.cronExpression
    },
    init() {
      this.newCronExpression = this.cronExpression
      this.isUpdated = false
    },
    submit() {
      // If custom expression input is focused then unfocus it instead of submitting
      if (this.$refs.expressionBuilder && this.$refs.expressionBuilder.checkBlurExpressionInput) {
        if (this.$refs.expressionBuilder.checkBlurExpressionInput()) {
          return
        }
      }

      this.processing = true

      var updatePayload = {
        backupSchedule: this.newCronExpression
      }
      this.$store
        .dispatch('updateServerSettings', updatePayload)
        .then((success) => {
          console.log('Updated Server Settings', success)
          this.processing = false
          this.show = false
          this.$emit('update:cronExpression', this.newCronExpression)
        })
        .catch((error) => {
          console.error('Failed to update server settings', error)
          this.processing = false
        })
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
