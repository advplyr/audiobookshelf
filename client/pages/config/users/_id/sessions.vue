<template>
  <div class="w-full h-full">
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-0 sm:p-4 mb-8">
      <nuxt-link :to="`/config/users/${user.id}`" class="text-white text-opacity-70 hover:text-opacity-100 hover:bg-white hover:bg-opacity-5 cursor-pointer rounded-full px-2 sm:px-0">
        <div class="flex items-center">
          <div class="h-10 w-10 flex items-center justify-center">
            <span class="material-icons text-2xl">arrow_back</span>
          </div>
          <p class="pl-1">Back to User</p>
        </div>
      </nuxt-link>
      <div class="flex items-center mb-2 mt-4 px-2 sm:px-0">
        <widgets-online-indicator :value="!!userOnline" />
        <h1 class="text-xl pl-2">{{ username }}</h1>
      </div>

      <div class="w-full h-px bg-white bg-opacity-10 my-2" />

      <div class="py-2">
        <h1 class="text-lg mb-2 text-white text-opacity-90 px-2 sm:px-0">Listening Sessions</h1>
        <table v-if="listeningSessions.length" class="userSessionsTable">
          <tr class="bg-primary bg-opacity-40">
            <th class="flex-grow text-left">Item</th>
            <th class="w-40 text-left hidden md:table-cell">Play Method</th>
            <th class="w-40 text-left hidden sm:table-cell">Device Info</th>
            <th class="w-20">Listening Time</th>
            <th class="w-20">Last Time</th>
            <!-- <th class="w-40 hidden sm:table-cell">Started At</th> -->
            <th class="w-40 hidden sm:table-cell">Last Update</th>
          </tr>
          <tr v-for="session in listeningSessions" :key="session.id">
            <td class="py-1">
              <p class="text-sm text-gray-200">{{ session.displayTitle }}</p>
              <p class="text-xs text-gray-400">{{ session.displayAuthor }}</p>
            </td>
            <td class="hidden md:table-cell">
              <p class="text-xs">{{ getPlayMethodName(session.playMethod) }} with {{ session.mediaPlayer }}</p>
            </td>
            <td class="hidden sm:table-cell">
              <p class="text-xs" v-html="getDeviceInfoString(session.deviceInfo)" />
            </td>
            <td class="text-center">
              <p class="text-xs font-mono">{{ $elapsedPretty(session.timeListening) }}</p>
            </td>
            <td class="text-center">
              <p class="text-xs font-mono">{{ $secondsToTimestamp(session.currentTime) }}</p>
            </td>
            <!-- <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="session.startedAt" direction="top" :text="$formatDate(session.startedAt, 'MMMM do, yyyy HH:mm')">
                <p class="text-xs">{{ $dateDistanceFromNow(session.startedAt) }}</p>
              </ui-tooltip>
            </td> -->
            <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="session.updatedAt" direction="top" :text="$formatDate(session.updatedAt, 'MMMM do, yyyy HH:mm')">
                <p class="text-xs">{{ $dateDistanceFromNow(session.updatedAt) }}</p>
              </ui-tooltip>
            </td>
          </tr>
        </table>
        <p v-else class="text-white text-opacity-50">No sessions yet...</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ params, redirect, app }) {
    var user = await app.$axios.$get(`/api/users/${params.id}`).catch((error) => {
      console.error('Failed to get user', error)
      return null
    })
    if (!user) return redirect('/config/users')
    return {
      user
    }
  },
  data() {
    return {
      listeningSessions: []
    }
  },
  computed: {
    username() {
      return this.user.username
    },
    userOnline() {
      return this.$store.getters['users/getIsUserOnline'](this.user.id)
    }
  },
  methods: {
    getDeviceInfoString(deviceInfo) {
      if (!deviceInfo) return ''
      var lines = []
      if (deviceInfo.osName) lines.push(`${deviceInfo.osName} ${deviceInfo.osVersion}`)
      if (deviceInfo.browserName) lines.push(deviceInfo.browserName)

      if (deviceInfo.manufacturer && deviceInfo.model) lines.push(`${deviceInfo.manufacturer} ${deviceInfo.model}`)
      if (deviceInfo.sdkVersion) lines.push(`SDK Version: ${deviceInfo.sdkVersion}`)
      return lines.join('<br>')
    },
    getPlayMethodName(playMethod) {
      if (playMethod === this.$constants.PlayMethod.DIRECTPLAY) return 'Direct Play'
      else if (playMethod === this.$constants.PlayMethod.TRANSCODE) return 'Transcode'
      else if (playMethod === this.$constants.PlayMethod.DIRECTSTREAM) return 'Direct Stream'
      else if (playMethod === this.$constants.PlayMethod.LOCAL) return 'Local'
      return 'Unknown'
    },
    async init() {
      console.log(navigator)

      this.listeningSessions = await this.$axios.$get(`/api/users/${this.user.id}/listening-sessions`).catch((err) => {
        console.error('Failed to load listening sesions', err)
        return []
      })
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style>
.userSessionsTable {
  border-collapse: collapse;
  width: 100%;
  border: 1px solid #474747;
}
.userSessionsTable tr:nth-child(even) {
  background-color: #2e2e2e;
}
.userSessionsTable tr:not(:first-child) {
  background-color: #373838;
}
.userSessionsTable tr:hover:not(:first-child) {
  background-color: #474747;
}
.userSessionsTable td {
  padding: 4px 8px;
}
.userSessionsTable th {
  padding: 4px 8px;
  font-size: 0.75rem;
}
</style>