<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderListeningSessions">
      <div class="flex justify-end mb-2">
        <ui-dropdown v-model="selectedUser" :items="userItems" :label="$strings.LabelFilterByUser" small class="max-w-48" @input="updateUserFilter" />
      </div>

      <div v-if="listeningSessions.length" class="block max-w-full relative">
        <table class="userSessionsTable">
          <tr class="bg-primary bg-opacity-40">
            <th class="w-6 min-w-6 text-left hidden md:table-cell h-11">
              <ui-checkbox v-model="isAllSelected" :partial="numSelected > 0 && !isAllSelected" small checkbox-bg="bg" />
            </th>
            <th v-if="numSelected" class="flex-grow text-left" :colspan="7">
              <div class="flex items-center">
                <p>{{ $getString('MessageSelected', [numSelected]) }}</p>
                <div class="flex-grow" />
                <ui-btn small color="error" :loading="deletingSessions" @click.stop="removeSessionsClick">{{ $strings.ButtonRemove }}</ui-btn>
              </div>
            </th>
            <th v-if="!numSelected" class="flex-grow sm:flex-grow-0 sm:w-48 sm:max-w-48 text-left group cursor-pointer" @click.stop="sortColumn('displayTitle')">
              <div class="inline-flex items-center">
                {{ $strings.LabelItem }} <span :class="{ 'opacity-0 group-hover:opacity-30': !isSortSelected('displayTitle') }" class="material-symbols text-base pl-px">{{ sortDesc ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
              </div>
            </th>
            <th v-if="!numSelected" class="w-20 min-w-20 text-left hidden md:table-cell">{{ $strings.LabelUser }}</th>
            <th v-if="!numSelected" class="w-26 min-w-26 text-left hidden md:table-cell group cursor-pointer" @click.stop="sortColumn('playMethod')">
              <div class="inline-flex items-center">
                {{ $strings.LabelPlayMethod }} <span :class="{ 'opacity-0 group-hover:opacity-30': !isSortSelected('playMethod') }" class="material-symbols text-base pl-px">{{ sortDesc ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
              </div>
            </th>
            <th v-if="!numSelected" class="w-32 min-w-32 text-left hidden sm:table-cell">{{ $strings.LabelDeviceInfo }}</th>
            <th v-if="!numSelected" class="w-24 min-w-24 sm:w-32 sm:min-w-32 group cursor-pointer" @click.stop="sortColumn('timeListening')">
              <div class="inline-flex items-center">
                {{ $strings.LabelTimeListened }} <span :class="{ 'opacity-0 group-hover:opacity-30': !isSortSelected('timeListening') }" class="material-symbols text-base pl-px hidden sm:inline-block">{{ sortDesc ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
              </div>
            </th>
            <th v-if="!numSelected" class="w-24 min-w-24 group cursor-pointer" @click.stop="sortColumn('currentTime')">
              <div class="inline-flex items-center">
                {{ $strings.LabelLastTime }} <span :class="{ 'opacity-0 group-hover:opacity-30': !isSortSelected('currentTime') }" class="material-symbols text-base pl-px hidden sm:inline-block">{{ sortDesc ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
              </div>
            </th>
            <th v-if="!numSelected" class="flex-grow hidden sm:table-cell cursor-pointer group" @click.stop="sortColumn('updatedAt')">
              <div class="inline-flex items-center">
                {{ $strings.LabelLastUpdate }} <span :class="{ 'opacity-0 group-hover:opacity-30': !isSortSelected('updatedAt') }" class="material-symbols text-base pl-px">{{ sortDesc ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
              </div>
            </th>
          </tr>

          <tr v-for="session in listeningSessions" :key="session.id" :class="{ selected: session.selected }" class="cursor-pointer" @click="clickSessionRow(session)">
            <td class="hidden md:table-cell py-1 max-w-6 relative">
              <ui-checkbox v-model="session.selected" small checkbox-bg="bg" />
              <!-- overlay of the checkbox so that the entire box is clickable -->
              <div class="absolute inset-0 w-full h-full" @click.stop="session.selected = !session.selected" />
            </td>
            <td class="py-1 flex-grow sm:flex-grow-0 sm:w-48 sm:max-w-48">
              <p class="text-xs text-gray-200 truncate">{{ session.displayTitle }}</p>
              <p class="text-xs text-gray-400 truncate">{{ session.displayAuthor }}</p>
            </td>
            <td class="hidden md:table-cell w-20 min-w-20">
              <p v-if="filteredUserUsername" class="text-xs">{{ filteredUserUsername }}</p>
              <p v-else class="text-xs">{{ session.user ? session.user.username : 'N/A' }}</p>
            </td>
            <td class="hidden md:table-cell w-26 min-w-26">
              <p class="text-xs">{{ getPlayMethodName(session.playMethod) }}</p>
            </td>
            <td class="hidden sm:table-cell max-w-32 min-w-32">
              <p class="text-xs truncate" v-html="getDeviceInfoString(session.deviceInfo)" />
            </td>
            <td class="text-center w-24 min-w-24 sm:w-32 sm:min-w-32">
              <p class="text-xs font-mono">{{ $elapsedPretty(session.timeListening) }}</p>
            </td>
            <td class="text-center hover:underline w-24 min-w-24" @click.stop="clickCurrentTime(session)">
              <p class="text-xs font-mono">{{ $secondsToTimestamp(session.currentTime) }}</p>
            </td>
            <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="session.updatedAt" direction="top" :text="$formatDatetime(session.updatedAt, dateFormat, timeFormat)">
                <p class="text-xs text-gray-200">{{ $dateDistanceFromNow(session.updatedAt) }}</p>
              </ui-tooltip>
            </td>
          </tr>
        </table>
        <!-- table bottom options -->
        <div class="flex items-center my-2">
          <div class="flex-grow" />
          <div class="hidden sm:inline-flex items-center">
            <p class="text-sm whitespace-nowrap">{{ $strings.LabelRowsPerPage }}</p>
            <ui-dropdown v-model="itemsPerPage" :items="itemsPerPageOptions" small class="w-24 mx-2" @input="updatedItemsPerPage" />
          </div>
          <div class="inline-flex items-center">
            <p class="text-sm mx-2">{{ $getString('LabelPaginationPageXOfY', [currentPage + 1, numPages]) }}</p>
            <ui-icon-btn icon="arrow_back_ios_new" :size="9" icon-font-size="1rem" class="mx-1" :disabled="currentPage === 0" @click="prevPage" />
            <ui-icon-btn icon="arrow_forward_ios" :size="9" icon-font-size="1rem" class="mx-1" :disabled="currentPage >= numPages - 1" @click="nextPage" />
          </div>
        </div>

        <div v-if="deletingSessions || loading" class="absolute inset-0 w-full h-full flex items-center justify-center">
          <ui-loading-indicator />
        </div>
      </div>
      <p v-else class="text-white text-opacity-50">{{ $strings.MessageNoListeningSessions }}</p>

      <div v-if="openListeningSessions.length" class="w-full my-8 h-px bg-white/10" />

      <!-- open listening sessions table -->
      <p v-if="openListeningSessions.length" class="text-lg my-4">{{ $strings.HeaderOpenListeningSessions }}</p>
      <div v-if="openListeningSessions.length" class="block max-w-full">
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

          <tr v-for="session in openListeningSessions" :key="`open-${session.id}`" class="cursor-pointer" @click="showSession(session)">
            <td class="py-1 max-w-48">
              <p class="text-xs text-gray-200 truncate">{{ session.displayTitle }}</p>
              <p class="text-xs text-gray-400 truncate">{{ session.displayAuthor }}</p>
            </td>
            <td class="hidden md:table-cell">
              <p class="text-xs">{{ session.user ? session.user.username : 'N/A' }}</p>
            </td>
            <td class="hidden md:table-cell">
              <p class="text-xs">{{ getPlayMethodName(session.playMethod) }}</p>
            </td>
            <td class="hidden sm:table-cell max-w-32 min-w-32">
              <p class="text-xs truncate" v-html="getDeviceInfoString(session.deviceInfo)" />
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
      </div>

      <div v-if="openShareListeningSessions.length" class="w-full my-8 h-px bg-white/10" />

      <!-- open share listening sessions table -->
      <p v-if="openShareListeningSessions.length" class="text-lg my-4">Open Share Listening Sessions</p>
      <div v-if="openShareListeningSessions.length" class="block max-w-full">
        <table class="userSessionsTable">
          <tr class="bg-primary bg-opacity-40">
            <th class="w-48 min-w-48 text-left">{{ $strings.LabelItem }}</th>
            <th class="w-20 min-w-20 text-left hidden md:table-cell">{{ $strings.LabelUser }}</th>
            <th class="w-32 min-w-32 text-left hidden md:table-cell">{{ $strings.LabelPlayMethod }}</th>
            <th class="w-32 min-w-32 text-left hidden sm:table-cell">{{ $strings.LabelDeviceInfo }}</th>
            <th class="w-16 min-w-16">{{ $strings.LabelLastTime }}</th>
            <th class="flex-grow hidden sm:table-cell">{{ $strings.LabelLastUpdate }}</th>
          </tr>

          <tr v-for="session in openShareListeningSessions" :key="`open-${session.id}`" class="cursor-pointer" @click="showSession(session)">
            <td class="py-1 max-w-48">
              <p class="text-xs text-gray-200 truncate">{{ session.displayTitle }}</p>
              <p class="text-xs text-gray-400 truncate">{{ session.displayAuthor }}</p>
            </td>
            <td class="hidden md:table-cell"></td>
            <td class="hidden md:table-cell">
              <p class="text-xs">{{ getPlayMethodName(session.playMethod) }}</p>
            </td>
            <td class="hidden sm:table-cell max-w-32 min-w-32">
              <p class="text-xs truncate" v-html="getDeviceInfoString(session.deviceInfo)" />
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
      </div>
    </app-settings-content>

    <modals-listening-session-modal v-model="showSessionModal" :session="selectedSession" @removedSession="removedSession" @closedSession="closedSession" />
  </div>
</template>

<script>
export default {
  async asyncData({ store, redirect, app }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
      return
    }

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
      loading: false,
      showSessionModal: false,
      selectedSession: null,
      listeningSessions: [],
      openListeningSessions: [],
      openShareListeningSessions: [],
      numPages: 0,
      total: 0,
      currentPage: 0,
      itemsPerPage: 10,
      userFilter: null,
      selectedUser: '',
      sortBy: 'updatedAt',
      sortDesc: true,
      processingGoToTimestamp: false,
      deletingSessions: false,
      itemsPerPageOptions: [10, 25, 50, 100]
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
      const user = this.users.find((u) => u.id === this.userFilter)
      return user?.username || null
    },
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    timeFormat() {
      return this.$store.state.serverSettings.timeFormat
    },
    numSelected() {
      return this.listeningSessions.filter((s) => s.selected).length
    },
    isAllSelected: {
      get() {
        return this.numSelected === this.listeningSessions.length
      },
      set(val) {
        this.setSelectionForAll(val)
      }
    }
  },
  methods: {
    isSortSelected(column) {
      return this.sortBy === column
    },
    sortColumn(column) {
      if (this.sortBy === column) {
        this.sortDesc = !this.sortDesc
      } else {
        this.sortBy = column
      }
      this.loadSessions(this.currentPage)
    },
    removeSelectedSessions() {
      if (!this.numSelected) return
      this.deletingSessions = true

      let isAllSessions = this.isAllSelected
      const payload = {
        sessions: this.listeningSessions.filter((s) => s.selected).map((s) => s.id)
      }
      this.$axios
        .$post(`/api/sessions/batch/delete`, payload)
        .then(() => {
          if (isAllSessions) {
            // If all sessions were removed from the current page then go to the previous page
            if (this.currentPage > 0) {
              this.currentPage--
            }
            this.loadSessions(this.currentPage)
          } else {
            // Filter out the deleted sessions
            this.listeningSessions = this.listeningSessions.filter((ls) => !payload.sessions.includes(ls.id))
          }
        })
        .catch((error) => {
          const errorMsg = error.response?.data || this.$strings.ToastRemoveFailed
          this.$toast.error(errorMsg)
        })
        .finally(() => {
          this.deletingSessions = false
        })
    },
    removeSessionsClick() {
      if (!this.numSelected) return
      const payload = {
        message: this.$getString('MessageConfirmRemoveListeningSessions', [this.numSelected]),
        callback: (confirmed) => {
          if (confirmed) {
            this.removeSelectedSessions()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    setSelectionForAll(val) {
      this.listeningSessions = this.listeningSessions.map((s) => {
        s.selected = val
        return s
      })
    },
    updatedItemsPerPage() {
      this.currentPage = 0
      this.loadSessions(this.currentPage)
    },
    closedSession() {
      this.loadOpenSessions()
    },
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
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        this.processingGoToTimestamp = false
        return
      }
      if (session.episodeId && !libraryItem.media.episodes.some((ep) => ep.id === session.episodeId)) {
        console.error('Episode not found in library item', session.episodeId, libraryItem.media.episodes)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
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
          caption: episode.publishedAt ? this.$getString('LabelPublishedDate', [this.$formatDate(episode.publishedAt, this.dateFormat)]) : this.$strings.LabelUnknownPublishDate,
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
    clickSessionRow(session) {
      if (this.numSelected > 0) {
        session.selected = !session.selected
      } else {
        this.showSession(session)
      }
    },
    showSession(session) {
      this.selectedSession = session
      this.showSessionModal = true
    },
    getDeviceInfoString(deviceInfo) {
      if (!deviceInfo) return ''
      var lines = []
      if (deviceInfo.clientName) lines.push(`${deviceInfo.clientName} ${deviceInfo.clientVersion || ''}`)
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
      this.loading = true
      const urlSearchParams = new URLSearchParams()
      urlSearchParams.set('page', page)
      urlSearchParams.set('itemsPerPage', this.itemsPerPage)
      urlSearchParams.set('sort', this.sortBy)
      urlSearchParams.set('desc', this.sortDesc ? '1' : '0')
      if (this.selectedUser) {
        urlSearchParams.set('user', this.selectedUser)
      }

      const data = await this.$axios.$get(`/api/sessions?${urlSearchParams.toString()}`).catch((err) => {
        console.error('Failed to load listening sessions', err)
        return null
      })
      this.loading = false
      if (!data) {
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        return
      }

      this.numPages = data.numPages
      this.total = data.total
      this.currentPage = data.page
      this.listeningSessions = data.sessions.map((ls) => {
        return {
          ...ls,
          selected: false
        }
      })
      this.userFilter = data.userId
    },
    async loadOpenSessions() {
      const data = await this.$axios.$get('/api/sessions/open').catch((err) => {
        console.error('Failed to load open sessions', err)
        return null
      })
      if (!data) {
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        return
      }

      this.openListeningSessions = (data.sessions || []).map((s) => {
        s.open = true
        return s
      })
      this.openShareListeningSessions = data.shareSessions || []
    },
    init() {
      this.loadSessions(0)
      this.loadOpenSessions()
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
.userSessionsTable tr:not(:first-child):not(.selected) {
  background-color: #373838;
}
.userSessionsTable tr:not(:first-child):nth-child(odd):not(.selected):not(:hover) {
  background-color: #2f2f2f;
}
.userSessionsTable tr:hover:not(:first-child) {
  background-color: #474747;
}
.userSessionsTable tr.selected {
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
