<template>
  <div class="w-full h-full">
    <div class="bg-bg rounded-md shadow-lg border border-white/5 p-0 sm:p-4 mb-8">
      <nuxt-link :to="`/config/users/${user.id}`" class="text-white/70 hover:text-white/100 hover:bg-white/5 cursor-pointer rounded-full px-2 sm:px-0">
        <div class="flex items-center">
          <div class="h-10 w-10 flex items-center justify-center">
            <span class="material-symbols text-2xl">arrow_back</span>
          </div>
          <p class="pl-1">{{ $strings.LabelBackToUser }}</p>
        </div>
      </nuxt-link>
      <div class="flex items-center mb-2 mt-4 px-2 sm:px-0">
        <widgets-online-indicator :value="!!userOnline" />
        <h1 class="text-xl pl-2">{{ username }}</h1>
      </div>

      <div class="w-full h-px bg-white/10 my-2" />

      <div class="py-2">
        <h1 class="text-lg mb-2 text-white/90 px-2 sm:px-0">{{ $strings.HeaderListeningSessions }}</h1>
        <div v-if="listeningSessions.length">
          <div class="overflow-x-auto">
            <table class="userSessionsTable">
              <tr class="bg-primary/40">
                <th class="w-48 min-w-48 text-left">{{ $strings.LabelItem }}</th>
                <th class="w-32 min-w-32 text-left hidden md:table-cell">{{ $strings.LabelPlayMethod }}</th>
                <th class="w-32 min-w-32 text-left hidden sm:table-cell">{{ $strings.LabelDeviceInfo }}</th>
                <th class="w-32 min-w-32">{{ $strings.LabelTimeListened }}</th>
                <th class="w-16 min-w-16">{{ $strings.LabelLastTime }}</th>
                <th class="grow hidden sm:table-cell">{{ $strings.LabelLastUpdate }}</th>
              </tr>
              <tr v-for="session in listeningSessions" :key="session.id" class="cursor-pointer" @click="showSession(session)">
                <td class="py-1 max-w-48">
                  <p class="text-xs text-gray-200 truncate">{{ session.displayTitle }}</p>
                  <p class="text-xs text-gray-400 truncate">{{ session.displayAuthor }}</p>
                </td>
                <td class="hidden md:table-cell">
                  <p class="text-xs">{{ getPlayMethodName(session.playMethod) }}</p>
                </td>
                <td class="hidden sm:table-cell min-w-32 max-w-32">
                  <p class="text-xs truncate" v-html="getDeviceInfoString(session.deviceInfo)" />
                </td>
                <td class="text-center">
                  <p class="text-xs font-mono">{{ $elapsedPrettyLocalized(session.timeListening) }}</p>
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
          <div class="flex items-center justify-end py-1">
            <ui-icon-btn icon="arrow_back_ios_new" :size="7" icon-font-size="1rem" class="mx-1" :disabled="currentPage === 0" @click="prevPage" />
            <p class="text-sm mx-1">{{ $getString('LabelPaginationPageXOfY', [currentPage + 1, numPages]) }}</p>
            <ui-icon-btn icon="arrow_forward_ios" :size="7" icon-font-size="1rem" class="mx-1" :disabled="currentPage >= numPages - 1" @click="nextPage" />
          </div>
        </div>
        <p v-else class="text-white/50">No sessions yet...</p>
      </div>
    </div>

    <modals-listening-session-modal v-model="showSessionModal" :session="selectedSession" @removedSession="removedSession" />
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
      showSessionModal: false,
      selectedSession: null,
      listeningSessions: [],
      numPages: 0,
      total: 0,
      currentPage: 0,
      itemsPerPage: 10,
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
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    },
    timeFormat() {
      return this.$store.getters['getServerSetting']('timeFormat')
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
      const data = await this.$axios.$get(`/api/users/${this.user.id}/listening-sessions?page=${page}&itemsPerPage=${this.itemsPerPage}`).catch((err) => {
        console.error('Failed to load listening sesions', err)
        return null
      })
      if (!data) {
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        return
      }

      this.numPages = data.numPages
      this.total = data.total
      this.currentPage = data.page
      this.listeningSessions = data.sessions
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
