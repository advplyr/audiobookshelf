<template>
  <div class="w-full h-full relative">
    <div id="scheduleWrapper" class="w-full overflow-y-auto px-2 py-4 md:px-6 md:py-6">
      <template v-if="!feedUrl">
        <widgets-alert type="warning" class="text-base mb-4">{{ $strings.ToastPodcastNoRssFeed }}</widgets-alert>
      </template>
      <template v-if="feedUrl || autoDownloadEpisodes">
        <div class="flex items-center justify-between mb-4">
          <p class="text-base md:text-xl font-semibold">{{ $strings.HeaderScheduleEpisodeDownloads }}</p>
          <ui-checkbox v-model="enableAutoDownloadEpisodes" :label="$strings.LabelEnable" medium checkbox-bg="bg" label-class="pl-2 text-base md:text-lg" />
        </div>

        <div v-if="enableAutoDownloadEpisodes" class="flex items-center py-2">
          <ui-text-input ref="maxEpisodesInput" type="number" v-model="newMaxEpisodesToKeep" no-spinner :padding-x="1" text-center class="w-10 text-base" @change="updatedMaxEpisodesToKeep" />
          <ui-tooltip :text="$strings.LabelMaxEpisodesToKeepHelp">
            <p class="pl-4 text-base">
              {{ $strings.LabelMaxEpisodesToKeep }}
              <span class="material-symbols icon-text">info</span>
            </p>
          </ui-tooltip>
        </div>
        <div v-if="enableAutoDownloadEpisodes" class="flex items-center py-2">
          <ui-text-input ref="maxEpisodesToDownloadInput" type="number" v-model="newMaxNewEpisodesToDownload" no-spinner :padding-x="1" text-center class="w-10 text-base" @change="updateMaxNewEpisodesToDownload" />
          <ui-tooltip :text="$strings.LabelUseZeroForUnlimited">
            <p class="pl-4 text-base">
              {{ $strings.LabelMaxEpisodesToDownloadPerCheck }}
              <span class="material-symbols icon-text">info</span>
            </p>
          </ui-tooltip>
        </div>

        <widgets-cron-expression-builder ref="cronExpressionBuilder" v-if="enableAutoDownloadEpisodes" v-model="cronExpression" />
      </template>
    </div>

    <div v-if="feedUrl || autoDownloadEpisodes" class="absolute bottom-0 left-0 w-full py-2 md:py-4 bg-bg border-t border-white border-opacity-5">
      <div class="flex items-center px-2 md:px-4">
        <div class="flex-grow" />
        <ui-btn @click="save" :disabled="!isUpdated" :color="isUpdated ? 'success' : 'primary'" class="mx-2">{{ isUpdated ? $strings.ButtonSave : $strings.MessageNoUpdatesWereNecessary }}</ui-btn>
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
      cronExpression: null,
      newMaxEpisodesToKeep: 0,
      newMaxNewEpisodesToDownload: 0
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
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
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    libraryItemId() {
      return this.libraryItem ? this.libraryItem.id : null
    },
    feedUrl() {
      return this.mediaMetadata.feedUrl
    },
    autoDownloadEpisodes() {
      return !!this.media.autoDownloadEpisodes
    },
    autoDownloadSchedule() {
      return this.media.autoDownloadSchedule
    },
    maxEpisodesToKeep() {
      return this.media.maxEpisodesToKeep
    },
    maxNewEpisodesToDownload() {
      return this.media.maxNewEpisodesToDownload
    },
    isUpdated() {
      return this.autoDownloadSchedule !== this.cronExpression || this.autoDownloadEpisodes !== this.enableAutoDownloadEpisodes || this.maxEpisodesToKeep !== Number(this.newMaxEpisodesToKeep) || this.maxNewEpisodesToDownload !== Number(this.newMaxNewEpisodesToDownload)
    }
  },
  methods: {
    updatedMaxEpisodesToKeep() {
      if (isNaN(this.newMaxEpisodesToKeep) || this.newMaxEpisodesToKeep < 0) {
        this.newMaxEpisodesToKeep = 0
      } else {
        this.newMaxEpisodesToKeep = Number(this.newMaxEpisodesToKeep)
      }
    },
    updateMaxNewEpisodesToDownload() {
      if (isNaN(this.newMaxNewEpisodesToDownload) || this.newMaxNewEpisodesToDownload < 0) {
        this.newMaxNewEpisodesToDownload = 0
      } else {
        this.newMaxNewEpisodesToDownload = Number(this.newMaxNewEpisodesToDownload)
      }
    },
    save() {
      // If custom expression input is focused then unfocus it instead of submitting
      if (this.$refs.cronExpressionBuilder && this.$refs.cronExpressionBuilder.checkBlurExpressionInput) {
        if (this.$refs.cronExpressionBuilder.checkBlurExpressionInput()) {
          return
        }
      }

      if (this.$refs.maxEpisodesInput?.isFocused) {
        this.$refs.maxEpisodesInput.blur()
      }
      if (this.$refs.maxEpisodesToDownloadInput?.isFocused) {
        this.$refs.maxEpisodesToDownloadInput.blur()
      }

      const updatePayload = {
        autoDownloadEpisodes: this.enableAutoDownloadEpisodes
      }
      if (this.enableAutoDownloadEpisodes) {
        updatePayload.autoDownloadSchedule = this.cronExpression
      }
      this.newMaxEpisodesToKeep = Number(this.newMaxEpisodesToKeep)
      if (this.newMaxEpisodesToKeep !== this.maxEpisodesToKeep) {
        updatePayload.maxEpisodesToKeep = this.newMaxEpisodesToKeep
      }
      this.newMaxNewEpisodesToDownload = Number(this.newMaxNewEpisodesToDownload)
      if (this.newMaxNewEpisodesToDownload !== this.maxNewEpisodesToDownload) {
        updatePayload.maxNewEpisodesToDownload = this.newMaxNewEpisodesToDownload
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
          this.$toast.success(this.$strings.ToastItemDetailsUpdateSuccess)
          return true
        } else {
          this.$toast.info(this.$strings.MessageNoUpdatesWereNecessary)
        }
      }
      return false
    },
    init() {
      this.enableAutoDownloadEpisodes = this.autoDownloadEpisodes
      this.cronExpression = this.autoDownloadSchedule
      this.newMaxEpisodesToKeep = this.maxEpisodesToKeep
      this.newMaxNewEpisodesToDownload = this.maxNewEpisodesToDownload
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
