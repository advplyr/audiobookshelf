<template>
  <div class="w-full h-full">
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-0 sm:p-4 mb-8">
      <nuxt-link to="/config/users" class="text-white text-opacity-70 hover:text-opacity-100 hover:bg-white hover:bg-opacity-5 cursor-pointer rounded-full px-2 sm:px-0">
        <div class="flex items-center">
          <div class="h-10 w-10 flex items-center justify-center">
            <span class="material-icons text-2xl">arrow_back</span>
          </div>
          <p class="pl-1">All Users</p>
        </div>
      </nuxt-link>
      <div class="flex items-center mb-2 mt-4 px-2 sm:px-0">
        <widgets-online-indicator :value="!!userOnline" />
        <h1 class="text-xl pl-2">{{ username }}</h1>
      </div>
      <div class="cursor-pointer text-gray-400 hover:text-white" @click="copyToClipboard(userToken)">
        <p v-if="userToken" class="py-2 text-xs">
          <strong class="text-white">API Token: </strong><br /><span class="text-white">{{ userToken }}</span
          ><span class="material-icons pl-2 text-base">content_copy</span>
        </p>
      </div>
      <div class="w-full h-px bg-white bg-opacity-10 my-2" />
      <div class="py-2">
        <h1 class="text-lg mb-2 text-white text-opacity-90 px-2 sm:px-0">Listening Stats</h1>
        <div class="flex items-center">
          <p class="text-sm text-gray-300">{{ listeningSessions.length }} Listening Sessions</p>
          <ui-btn :to="`/config/users/${user.id}/sessions`" class="text-xs mx-2" :padding-x="1.5" :padding-y="1">View All</ui-btn>
        </div>
        <p class="text-sm text-gray-300">
          Total Time Listened:&nbsp;
          <span class="font-mono text-base">{{ listeningTimePretty }}</span>
        </p>
        <p v-if="timeListenedToday" class="text-sm text-gray-300">
          Time Listened Today:&nbsp;
          <span class="font-mono text-base">{{ $elapsedPrettyExtended(timeListenedToday) }}</span>
        </p>

        <div v-if="latestSession" class="mt-4">
          <h1 class="text-lg mb-2 text-white text-opacity-90 px-2 sm:px-0">Last Listening Session</h1>
          <p class="text-sm text-gray-300">
            <strong>{{ latestSession.displayTitle }}</strong> {{ $dateDistanceFromNow(latestSession.updatedAt) }} for <span class="font-mono text-base">{{ $elapsedPrettyExtended(this.latestSession.timeListening) }}</span>
          </p>
        </div>
      </div>
      <div class="w-full h-px bg-white bg-opacity-10 my-2" />
      <div class="py-2">
        <h1 class="text-lg mb-2 text-white text-opacity-90 px-2 sm:px-0">Item Progress</h1>
        <table v-if="mediaProgress.length" class="userAudiobooksTable">
          <tr class="bg-primary bg-opacity-40">
            <th class="w-16 text-left">Item</th>
            <th class="text-left"></th>
            <th class="w-32">Progress</th>
            <th class="w-40 hidden sm:table-cell">Started At</th>
            <th class="w-40 hidden sm:table-cell">Last Update</th>
          </tr>
          <tr v-for="item in mediaProgress" :key="item.id" :class="!item.isFinished ? '' : 'isFinished'">
            <td>
              <covers-book-cover :width="50" :library-item="item" :book-cover-aspect-ratio="bookCoverAspectRatio" />
            </td>
            <td class="font-book">
              <p>{{ item.media && item.media.metadata ? item.media.metadata.title : 'Unknown' }}</p>
              <p v-if="item.media && item.media.metadata && item.media.metadata.authorName" class="text-white text-opacity-50 text-sm font-sans">by {{ item.media.metadata.authorName }}</p>
            </td>
            <td class="text-center">
              <p class="text-sm">{{ Math.floor(item.progress * 100) }}%</p>
            </td>
            <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="item.startedAt" direction="top" :text="$formatDate(item.startedAt, 'MMMM do, yyyy HH:mm')">
                <p class="text-sm">{{ $dateDistanceFromNow(item.startedAt) }}</p>
              </ui-tooltip>
            </td>
            <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="item.lastUpdate" direction="top" :text="$formatDate(item.lastUpdate, 'MMMM do, yyyy HH:mm')">
                <p class="text-sm">{{ $dateDistanceFromNow(item.lastUpdate) }}</p>
              </ui-tooltip>
            </td>
          </tr>
        </table>
        <p v-else class="text-white text-opacity-50">Nothing listened to yet...</p>
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
      listeningSessions: [],
      listeningStats: {}
    }
  },
  computed: {
    userToken() {
      return this.user.token
    },
    coverAspectRatio() {
      return this.$store.getters['getServerSetting']('coverAspectRatio')
    },
    bookCoverAspectRatio() {
      return this.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE ? 1 : 1.6
    },
    username() {
      return this.user.username
    },
    userOnline() {
      return this.$store.getters['users/getIsUserOnline'](this.user.id)
    },
    mediaProgress() {
      return this.user.mediaProgress.sort((a, b) => b.lastUpdate - a.lastUpdate)
    },
    totalListeningTime() {
      return this.listeningStats.totalTime || 0
    },
    listeningTimePretty() {
      return this.$elapsedPrettyExtended(this.totalListeningTime)
    },
    timeListenedToday() {
      return this.listeningStats.today || 0
    },
    latestSession() {
      if (!this.listeningSessions.length) return null
      return this.listeningSessions[0]
    }
  },
  methods: {
    copyToClipboard(str) {
      this.$copyToClipboard(str, this)
    },
    async init() {
      this.listeningSessions = await this.$axios.$get(`/api/users/${this.user.id}/listening-sessions`).catch((err) => {
        console.error('Failed to load listening sesions', err)
        return []
      })
      this.listeningStats = await this.$axios.$get(`/api/users/${this.user.id}/listening-stats`).catch((err) => {
        console.error('Failed to load listening sesions', err)
        return []
      })
      console.log('Loaded user listening data', this.listeningSessions, this.listeningStats)
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style>
.userAudiobooksTable {
  border-collapse: collapse;
  width: 100%;
  border: 1px solid #474747;
}
.userAudiobooksTable tr:nth-child(even) {
  background-color: #2e2e2e;
}
.userAudiobooksTable tr:not(:first-child) {
  background-color: #373838;
}
.userAudiobooksTable tr:hover:not(:first-child) {
  background-color: #474747;
}
.userAudiobooksTable tr.isFinished {
  background-color: rgba(76, 175, 80, 0.1);
}
.userAudiobooksTable td {
  padding: 4px 8px;
}
.userAudiobooksTable th {
  padding: 4px 8px;
  font-size: 0.75rem;
}
</style>