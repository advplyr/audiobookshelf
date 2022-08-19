<template>
  <div class="w-full h-full relative">
    <div id="scheduleWrapper" class="w-full overflow-y-auto px-2 py-4 md:px-4 md:py-6">
      <div class="flex items-center justify-between mb-4">
        <p class="text-base md:text-lg font-semibold">Schedule Automatic Episode Downloads</p>
        <ui-checkbox v-model="enableAutoDownloadEpisodes" label="Enable" small checkbox-bg="bg" label-class="pl-2 text-base" />
      </div>
      <widgets-cron-expression-builder ref="cronExpressionBuilder" v-if="enableAutoDownloadEpisodes" v-model="cronExpression" @input="updatedCron" />
    </div>

    <div class="absolute bottom-0 left-0 w-full py-2 md:py-4 bg-bg border-t border-white border-opacity-5">
      <div class="flex items-center px-2 md:px-4">
        <div class="flex-grow" />
        <ui-btn @click="save" :disabled="!isUpdated" :color="isUpdated ? 'success' : 'primary'" class="mx-2">{{ isUpdated ? 'Save' : 'No update necessary' }}</ui-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      enableAutoDownloadEpisodes: false,
      cronExpression: null
    }
  },
  computed: {
    isProcessing: {
      get() {
        return this.processing
      },
      set(val) {
        this.$emit('update:processing', val)
      }
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    autoDownloadEpisodes() {
      return !!this.media.autoDownloadEpisodes
    },
    autoDownloadSchedule() {
      return this.media.autoDownloadSchedule
    },
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    libraryItemId() {
      return this.libraryItem ? this.libraryItem.id : null
    },
    isUpdated() {
      return this.autoDownloadSchedule !== this.cronExpression || this.autoDownloadEpisodes !== this.enableAutoDownloadEpisodes
    }
  },
  methods: {
    init() {
      this.enableAutoDownloadEpisodes = this.autoDownloadEpisodes
      this.cronExpression = this.autoDownloadSchedule
    },
    updatedCron() {
      console.log('Updated cron', this.cronExpression)
    },
    save() {
      // If custom expression input is focused then unfocus it instead of submitting
      if (this.$refs.cronExpressionBuilder && this.$refs.cronExpressionBuilder.checkBlurExpressionInput) {
        if (this.$refs.cronExpressionBuilder.checkBlurExpressionInput()) {
          return
        }
      }

      const updatePayload = {
        autoDownloadEpisodes: this.enableAutoDownloadEpisodes
      }
      if (this.enableAutoDownloadEpisodes) {
        updatePayload.autoDownloadSchedule = this.cronExpression
      }
      this.updateDetails(updatePayload)
    },
    async updateDetails(updatePayload) {
      this.isProcessing = true
      var updateResult = await this.$axios.$patch(`/api/items/${this.libraryItemId}/media`, updatePayload).catch((error) => {
        console.error('Failed to update', error)
        return false
      })
      this.isProcessing = false
      if (updateResult) {
        if (updateResult.updated) {
          this.$toast.success('Item details updated')
          return true
        } else {
          this.$toast.info('No updates were necessary')
        }
      }
      return false
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style scoped>
#scheduleWrapper {
  height: calc(100% - 80px);
  max-height: calc(100% - 80px);
}
</style>