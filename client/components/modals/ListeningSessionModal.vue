<template>
  <modals-modal v-model="show" name="listening-session-modal" :processing="processing" :width="700" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-lg md:text-2xl text-white truncate">{{ $strings.HeaderSession }} {{ _session.id }}</p>
      </div>
    </template>
    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden p-6" style="max-height: 80vh">
      <div class="flex items-center">
        <p class="text-base text-gray-200">{{ _session.displayTitle }}</p>
        <p v-if="_session.displayAuthor" class="text-xs text-gray-400 px-4">{{ $getString('LabelByAuthor', [_session.displayAuthor]) }}</p>
      </div>

      <div class="w-full h-px bg-white bg-opacity-10 my-4" />

      <div class="flex flex-wrap mb-4">
        <div class="w-full md:w-2/3">
          <p class="font-semibold uppercase text-xs text-gray-400 tracking-wide mb-2">{{ $strings.HeaderDetails }}</p>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelStartedAt }}</div>
            <div class="px-1">
              {{ $formatDatetime(_session.startedAt, dateFormat, timeFormat) }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelUpdatedAt }}</div>
            <div class="px-1">
              {{ $formatDatetime(_session.updatedAt, dateFormat, timeFormat) }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelTimeListened }}</div>
            <div class="px-1">
              {{ $elapsedPrettyExtended(_session.timeListening) }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelStartTime }}</div>
            <div class="px-1">
              {{ $secondsToTimestamp(_session.startTime) }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelLastTime }}</div>
            <div class="px-1">
              {{ $secondsToTimestamp(_session.currentTime) }}
            </div>
          </div>

          <p class="font-semibold uppercase text-xs text-gray-400 tracking-wide mt-6 mb-2">{{ $strings.LabelItem }}</p>
          <div v-if="_session.libraryId" class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelLibrary }} Id</div>
            <div class="px-1 text-xs">
              {{ _session.libraryId }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelLibraryItem }} Id</div>
            <div class="px-1 text-xs">
              {{ _session.libraryItemId }}
            </div>
          </div>
          <div v-if="_session.episodeId" class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelEpisode }} Id</div>
            <div class="px-1 text-xs">
              {{ _session.episodeId }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelMediaType }}</div>
            <div class="px-1">
              {{ _session.mediaType }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">{{ $strings.LabelDuration }}</div>
            <div class="px-1">
              {{ $elapsedPretty(_session.duration) }}
            </div>
          </div>
        </div>
        <div class="w-full md:w-1/3">
          <p v-if="!isMediaItemShareSession" class="font-semibold uppercase text-xs text-gray-400 tracking-wide mb-2 mt-6 md:mt-0">{{ $strings.LabelUser }}</p>
          <p v-if="!isMediaItemShareSession" class="mb-1 text-xs">{{ _session.userId }}</p>

          <p class="font-semibold uppercase text-xs text-gray-400 tracking-wide mt-6 mb-2">{{ $strings.LabelMediaPlayer }}</p>
          <p class="mb-1">{{ playMethodName }}</p>
          <p class="mb-1">{{ _session.mediaPlayer }}</p>

          <p v-if="hasDeviceInfo" class="font-semibold uppercase text-xs text-gray-400 tracking-wide mt-6 mb-2">{{ $strings.LabelDevice }}</p>
          <p v-if="clientDisplayName" class="mb-1">{{ clientDisplayName }}</p>
          <p v-if="deviceInfo.ipAddress" class="mb-1">{{ deviceInfo.ipAddress }}</p>
          <p v-if="osDisplayName" class="mb-1">{{ osDisplayName }}</p>
          <p v-if="deviceInfo.browserName" class="mb-1">{{ deviceInfo.browserName }}</p>
          <p v-if="deviceDisplayName" class="mb-1">{{ deviceDisplayName }}</p>
          <p v-if="deviceInfo.sdkVersion" class="mb-1">SDK {{ $strings.LabelVersion }}: {{ deviceInfo.sdkVersion }}</p>
          <p v-if="deviceInfo.deviceType" class="mb-1">{{ $strings.LabelType }}: {{ deviceInfo.deviceType }}</p>
        </div>
      </div>

      <div class="flex items-center">
        <ui-btn v-if="!isOpenSession && !isMediaItemShareSession" small color="error" @click.stop="deleteSessionClick">{{ $strings.ButtonDelete }}</ui-btn>
        <ui-btn v-else-if="!isMediaItemShareSession" small color="error" @click.stop="closeSessionClick">{{ $strings.ButtonCloseSession }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    session: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      processing: false
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
    _session() {
      return this.session || {}
    },
    deviceInfo() {
      return this._session.deviceInfo || {}
    },
    hasDeviceInfo() {
      return Object.keys(this.deviceInfo).length
    },
    osDisplayName() {
      if (!this.deviceInfo.osName) return null
      return `${this.deviceInfo.osName} ${this.deviceInfo.osVersion}`
    },
    deviceDisplayName() {
      if (!this.deviceInfo.manufacturer || !this.deviceInfo.model) return null
      return `${this.deviceInfo.manufacturer} ${this.deviceInfo.model}`
    },
    clientDisplayName() {
      if (!this.deviceInfo.clientName) return null
      return `${this.deviceInfo.clientName} ${this.deviceInfo.clientVersion || ''}`
    },
    playMethodName() {
      const playMethod = this._session.playMethod
      if (playMethod === this.$constants.PlayMethod.DIRECTPLAY) return 'Direct Play'
      else if (playMethod === this.$constants.PlayMethod.TRANSCODE) return 'Transcode'
      else if (playMethod === this.$constants.PlayMethod.DIRECTSTREAM) return 'Direct Stream'
      else if (playMethod === this.$constants.PlayMethod.LOCAL) return 'Local'
      return 'Unknown'
    },
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    timeFormat() {
      return this.$store.state.serverSettings.timeFormat
    },
    isOpenSession() {
      return !!this._session.open
    },
    isMediaItemShareSession() {
      return this._session.mediaPlayer === 'web-share'
    }
  },
  methods: {
    deleteSessionClick() {
      const payload = {
        message: this.$strings.MessageConfirmDeleteSession,
        callback: (confirmed) => {
          if (confirmed) {
            this.deleteSession()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    deleteSession() {
      this.processing = true
      this.$axios
        .$delete(`/api/sessions/${this._session.id}`)
        .then(() => {
          this.processing = false
          this.$toast.success(this.$strings.ToastSessionDeleteSuccess)
          this.$emit('removedSession')
          this.show = false
        })
        .catch((error) => {
          this.processing = false
          console.error('Failed to delete session', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(errMsg || this.$strings.ToastSessionDeleteFailed)
        })
    },
    closeSessionClick() {
      this.processing = true
      this.$axios
        .$post(`/api/session/${this._session.id}/close`)
        .then(() => {
          this.show = false
          this.$emit('closedSession')
        })
        .catch((error) => {
          console.error('Failed to close session', error)
          const errMsg = error.response?.data || ''
          this.$toast.error(errMsg || this.$strings.ToastSessionCloseFailed)
        })
        .finally(() => {
          this.processing = false
        })
    }
  },
  mounted() {}
}
</script>
