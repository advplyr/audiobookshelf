<template>
  <div class="w-full h-full">
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-0 sm:p-4 mb-8">
      <div class="py-2">
        <div class="flex items-center mb-1">
          <h1 class="text-lg mb-2 text-white text-opacity-90 px-2 sm:px-0">Listening Sessions</h1>
          <div class="flex-grow" />

          <ui-dropdown v-model="selectedUser" :items="userItems" label="Filter by User" small class="max-w-48" @input="updateUserFilter" />
        </div>
        <div v-if="listeningSessions.length">
          <table class="userSessionsTable">
            <tr class="bg-primary bg-opacity-40">
              <th class="flex-grow text-left">Item</th>
              <th class="w-20 text-left">User</th>
              <th class="w-32 text-left hidden md:table-cell">Play Method</th>
              <th class="w-40 text-left hidden sm:table-cell">Device Info</th>
              <th class="w-20">Listened</th>
              <th class="w-20">Last Time</th>
              <th class="w-40 hidden sm:table-cell">Last Update</th>
            </tr>
            <tr v-for="session in listeningSessions" :key="session.id" class="cursor-pointer" @click="showSession(session)">
              <td class="py-1">
                <p class="text-sm text-gray-200">{{ session.displayTitle }}</p>
                <p class="text-xs text-gray-400">{{ session.displayAuthor }}</p>
              </td>
              <td class="hidden md:table-cell">
                <p v-if="filteredUserUsername" class="text-xs">{{ filteredUserUsername }}</p>
                <p v-else class="text-xs">{{ session.user ? session.user.username : 'N/A' }}</p>
              </td>
              <td class="hidden md:table-cell">
                <p class="text-xs">{{ getPlayMethodName(session.playMethod) }}</p>
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
              <td class="text-center hidden sm:table-cell">
                <ui-tooltip v-if="session.updatedAt" direction="top" :text="$formatDate(session.updatedAt, 'MMMM do, yyyy HH:mm')">
                  <p class="text-xs">{{ $dateDistanceFromNow(session.updatedAt) }}</p>
                </ui-tooltip>
              </td>
            </tr>
          </table>
          <div class="flex items-center justify-end py-1">
            <ui-icon-btn icon="arrow_back_ios_new" :size="7" icon-font-size="1rem" class="mx-1" :disabled="currentPage === 0" @click="prevPage" />
            <p class="text-sm mx-1">Page {{ currentPage + 1 }} of {{ numPages }}</p>
            <ui-icon-btn icon="arrow_forward_ios" :size="7" icon-font-size="1rem" class="mx-1" :disabled="currentPage >= numPages - 1" @click="nextPage" />
          </div>
        </div>
        <p v-else class="text-white text-opacity-50">No sessions yet...</p>
      </div>
    </div>

    <modals-listening-session-modal v-model="showSessionModal" :session="selectedSession" />
  </div>
</template>

<script>
export default {
  async asyncData({ params, redirect, app }) {
    var users = await app.$axios
      .$get('/api/users')
      .then((users) => {
        return users.sort((a, b) => {
          return a.createdAt - b.createdAt
        })
      })
      .catch((error) => {
        console.error('Failed', error)
        return []
      })
    return {
      users
    }
  },
  data() {
    return {
      showSessionModal: false,
      selectedSession: null,
      listeningSessions: [],
      numPages: 0,
      total: 0,
      currentPage: 0,
      userFilter: null,
      selectedUser: ''
    }
  },
  computed: {
    username() {
      return this.user.username
    },
    userOnline() {
      return this.$store.getters['users/getIsUserOnline'](this.user.id)
    },
    userItems() {
      var userItems = [{ value: '', text: 'All Users' }]
      return userItems.concat(this.users.map((u) => ({ value: u.id, text: u.username })))
    },
    filteredUserUsername() {
      if (!this.userFilter) return null
      var user = this.users.find((u) => u.id === this.userFilter)
      return user ? user.username : null
    }
  },
  methods: {
    updateUserFilter() {
      this.loadSessions(0)
    },
    prevPage() {
      this.loadSessions(this.currentPage - 1)
    },
    nextPage() {
      this.loadSessions(this.currentPage + 1)
    },
    showSession(session) {
      this.selectedSession = session
      this.showSessionModal = true
    },
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
    async loadSessions(page) {
      var userFilterQuery = this.selectedUser ? `&user=${this.selectedUser}` : ''
      const data = await this.$axios.$get(`/api/sessions?page=${page}&itemsPerPage=10${userFilterQuery}`).catch((err) => {
        console.error('Failed to load listening sesions', err)
        return null
      })
      if (!data) {
        this.$toast.error('Failed to load listening sessions')
        return
      }

      this.numPages = data.numPages
      this.total = data.total
      this.currentPage = data.page
      this.listeningSessions = data.sessions
      this.userFilter = data.userFilter
    },
    init() {
      this.loadSessions(0)
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
.userSessionsTable tr:first-child {
  background-color: #272727;
}
.userSessionsTable tr:not(:first-child) {
  background-color: #373838;
}
.userSessionsTable tr:not(:first-child):nth-child(odd) {
  background-color: #2f2f2f;
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