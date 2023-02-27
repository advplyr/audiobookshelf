<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderListeningSessions">
      <div class="flex justify-end mb-2">
        <ui-dropdown v-model="selectedUser" :items="userItems" :label="$strings.LabelFilterByUser" small class="max-w-48" @input="updateUserFilter" />
      </div>

      <div v-if="listeningSessions.length" class="block max-w-full">
        <table class="userSessionsTable">
          <tr class="bg-primary bg-opacity-40">
            <th class="w-48 min-w-48 text-left">{{ $strings.LabelItem }}</th>
            <th class="w-20 min-w-20 text-left hidden md:table-cell">{{ $strings.LabelUser }}</th>
            <th class="w-32 min-w-32 text-left hidden md:table-cell">{{ $strings.LabelPlayMethod }}</th>
            <th class="w-32 min-w-32 text-left hidden sm:table-cell">{{ $strings.LabelDeviceInfo }}</th>
            <th class="w-32 min-w-32">{{ $strings.LabelTimeListened }}</th>
            <th class="w-16 min-w-16">{{ $strings.LabelLastTime }}</th>
            <th class="flex-grow hidden sm:table-cell">{{ $strings.LabelLastUpdate }}</th>
          </tr>

          <tr v-for="session in listeningSessions" :key="session.id" class="cursor-pointer" @click="showSession(session)">
            <td class="py-1 max-w-48">
              <p class="text-xs text-gray-200 truncate">{{ session.displayTitle }}</p>
              <p class="text-xs text-gray-400 truncate">{{ session.displayAuthor }}</p>
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
            <td class="text-center hover:underline" @click.stop="clickCurrentTime(session)">
              <p class="text-xs font-mono">{{ $secondsToTimestamp(session.currentTime) }}</p>
            </td>
            <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="session.updatedAt" direction="top" :text="$formatDatetime(session.updatedAt, dateFormat, timeFormat)">
                <p class="text-xs text-gray-200">{{ $dateDistanceFromNow(session.updatedAt) }}</p>
              </ui-tooltip>
            </td>
          </tr>
        </table>
        <div class="flex items-center justify-end my-2">
          <ui-icon-btn icon="arrow_back_ios_new" :size="7" icon-font-size="1rem" class="mx-1" :disabled="currentPage === 0" @click="prevPage" />
          <p class="text-sm mx-1">Page {{ currentPage + 1 }} of {{ numPages }}</p>
          <ui-icon-btn icon="arrow_forward_ios" :size="7" icon-font-size="1rem" class="mx-1" :disabled="currentPage >= numPages - 1" @click="nextPage" />
        </div>
      </div>
      <p v-else class="text-white text-opacity-50">{{ $strings.MessageNoListeningSessions }}</p>
    </app-settings-content>

    <modals-listening-session-modal v-model="showSessionModal" :session="selectedSession" @removedSession="removedSession" />
  </div>
</template>

<script>
export default {
  async asyncData({ params, redirect, app }) {
    const users = await app.$axios
      .$get('/api/users')
      .then((res) => {
        return res.users.sort((a, b) => {
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
      itemsPerPage: 10,
      userFilter: null,
      selectedUser: '',
      processingGoToTimestamp: false
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
      var userItems = [{ value: '', text: this.$strings.LabelAllUsers }]
      return userItems.concat(this.users.map((u) => ({ value: u.id, text: u.username })))
    },
    filteredUserUsername() {
      if (!this.userFilter) return null
      var user = this.users.find((u) => u.id === this.userFilter)
      return user ? user.username : null
    },
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    timeFormat() {
      return this.$store.state.serverSettings.timeFormat
    }
  },
  methods: {
    removedSession() {
      // If on last page and this was the last session then load prev page
      if (this.currentPage == this.numPages - 1) {
        const newTotal = this.total - 1
        const newNumPages = Math.ceil(newTotal / this.itemsPerPage)
        if (newNumPages < this.numPages) {
          this.prevPage()
          return
        }
      }

      this.loadSessions(this.currentPage)
    },
    async clickCurrentTime(session) {
      if (this.processingGoToTimestamp) return
      this.processingGoToTimestamp = true
      const libraryItem = await this.$axios.$get(`/api/items/${session.libraryItemId}`).catch((error) => {
        console.error('Failed to get library item', error)
        return null
      })

      if (!libraryItem) {
        this.$toast.error('Failed to get library item')
        this.processingGoToTimestamp = false
        return
      }
      if (session.episodeId && !libraryItem.media.episodes.some((ep) => ep.id === session.episodeId)) {
        this.$toast.error('Failed to get podcast episode')
        this.processingGoToTimestamp = false
        return
      }

      var queueItem = {}
      if (session.episodeId) {
        var episode = libraryItem.media.episodes.find((ep) => ep.id === session.episodeId)
        queueItem = {
          libraryItemId: libraryItem.id,
          libraryId: libraryItem.libraryId,
          episodeId: episode.id,
          title: episode.title,
          subtitle: libraryItem.media.metadata.title,
          caption: episode.publishedAt ? `Published ${this.$formatDate(episode.publishedAt, this.dateFormat)}` : 'Unknown publish date',
          duration: episode.audioFile.duration || null,
          coverPath: libraryItem.media.coverPath || null
        }
      } else {
        queueItem = {
          libraryItemId: libraryItem.id,
          libraryId: libraryItem.libraryId,
          episodeId: null,
          title: libraryItem.media.metadata.title,
          subtitle: libraryItem.media.metadata.authors.map((au) => au.name).join(', '),
          caption: '',
          duration: libraryItem.media.duration || null,
          coverPath: libraryItem.media.coverPath || null
        }
      }

      const payload = {
        message: this.$getString('MessageStartPlaybackAtTime', [session.displayTitle, this.$secondsToTimestamp(session.currentTime)]),
        callback: (confirmed) => {
          if (confirmed) {
            this.$eventBus.$emit('play-item', {
              libraryItemId: libraryItem.id,
              episodeId: session.episodeId || null,
              startTime: session.currentTime,
              queueItems: [queueItem]
            })
          }
          this.processingGoToTimestamp = false
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
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
      const data = await this.$axios.$get(`/api/sessions?page=${page}&itemsPerPage=${this.itemsPerPage}${userFilterQuery}`).catch((err) => {
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

<style scoped>
.userSessionsTable {
  border-collapse: collapse;
  width: 100%;
  max-width: 100%;
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
