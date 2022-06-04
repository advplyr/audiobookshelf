<template>
  <modals-modal v-model="show" name="listening-session-modal" :width="700" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">Session {{ _session.id }}</p>
      </div>
    </template>
    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden p-6" style="max-height: 80vh">
      <div class="flex items-center">
        <p class="text-base text-gray-200">{{ _session.displayTitle }}</p>
        <p v-if="_session.displayAuthor" class="text-xs text-gray-400 px-4">by {{ _session.displayAuthor }}</p>
      </div>

      <div class="w-full h-px bg-white bg-opacity-10 my-4" />

      <div class="flex flex-wrap mb-4">
        <div class="w-full md:w-2/3">
          <p class="font-semibold uppercase text-xs text-gray-400 tracking-wide mb-2">Details</p>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Started At</div>
            <div class="px-1">
              {{ $formatDate(_session.startedAt, 'MMMM do, yyyy HH:mm') }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Updated At</div>
            <div class="px-1">
              {{ $formatDate(_session.updatedAt, 'MMMM do, yyyy HH:mm') }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Listened for</div>
            <div class="px-1">
              {{ $elapsedPrettyExtended(_session.timeListening) }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Start Time</div>
            <div class="px-1">
              {{ $secondsToTimestamp(_session.startTime) }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Last Time</div>
            <div class="px-1">
              {{ $secondsToTimestamp(_session.currentTime) }}
            </div>
          </div>

          <p class="font-semibold uppercase text-xs text-gray-400 tracking-wide mt-6 mb-2">Item</p>
          <div v-if="_session.libraryId" class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Library Id</div>
            <div class="px-1">
              {{ _session.libraryId }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Library Item Id</div>
            <div class="px-1">
              {{ _session.libraryItemId }}
            </div>
          </div>
          <div v-if="_session.episodeId" class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Episode Id</div>
            <div class="px-1">
              {{ _session.episodeId }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Media Type</div>
            <div class="px-1">
              {{ _session.mediaType }}
            </div>
          </div>
          <div class="flex items-center -mx-1 mb-1">
            <div class="w-40 px-1 text-gray-200">Duration</div>
            <div class="px-1">
              {{ $elapsedPretty(_session.duration) }}
            </div>
          </div>
        </div>
        <div class="w-full md:w-1/3">
          <p class="font-semibold uppercase text-xs text-gray-400 tracking-wide mb-2 mt-6 md:mt-0">User</p>
          <p class="mb-1">{{ _session.userId }}</p>

          <p class="font-semibold uppercase text-xs text-gray-400 tracking-wide mt-6 mb-2">Media Player</p>
          <p class="mb-1">{{ playMethodName }}</p>
          <p class="mb-1">{{ _session.mediaPlayer }}</p>

          <p v-if="hasDeviceInfo" class="font-semibold uppercase text-xs text-gray-400 tracking-wide mt-6 mb-2">Device</p>
          <p v-if="deviceInfo.ipAddress" class="mb-1">{{ deviceInfo.ipAddress }}</p>
          <p v-if="osDisplayName" class="mb-1">{{ osDisplayName }}</p>
          <p v-if="deviceInfo.browserName" class="mb-1">{{ deviceInfo.browserName }}</p>
          <p v-if="clientDisplayName" class="mb-1">{{ clientDisplayName }}</p>
          <p v-if="deviceInfo.sdkVersion" class="mb-1">SDK Version: {{ deviceInfo.sdkVersion }}</p>
          <p v-if="deviceInfo.deviceType" class="mb-1">Type: {{ deviceInfo.deviceType }}</p>
        </div>
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
    return {}
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
    clientDisplayName() {
      if (!this.deviceInfo.manufacturer || !this.deviceInfo.model) return null
      return `${this.deviceInfo.manufacturer} ${this.deviceInfo.model}`
    },
    playMethodName() {
      const playMethod = this._session.playMethod
      if (playMethod === this.$constants.PlayMethod.DIRECTPLAY) return 'Direct Play'
      else if (playMethod === this.$constants.PlayMethod.TRANSCODE) return 'Transcode'
      else if (playMethod === this.$constants.PlayMethod.DIRECTSTREAM) return 'Direct Stream'
      else if (playMethod === this.$constants.PlayMethod.LOCAL) return 'Local'
      return 'Unknown'
    }
  },
  methods: {},
  mounted() {}
}
</script>