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
      <div v-if="userToken" class="flex text-xs mt-4">
        <ui-text-input-with-label label="API Token" :value="userToken" readonly />

        <div class="px-1 mt-8 cursor-pointer" @click="copyToClipboard(userToken)">
          <span class="material-icons pl-2 text-base">content_copy</span>
        </div>
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
        <h1 class="text-lg mb-2 text-white text-opacity-90 px-2 sm:px-0">Saved Media Progress</h1>

        <div v-if="mediaProgressWithoutMedia.length" class="flex items-center py-2 mb-2">
          <p class="text-error">User has media progress for {{ mediaProgressWithoutMedia.length }} items that no longer exist.</p>
          <div class="flex-grow" />
          <ui-btn small :loading="purgingMediaProgress" @click.stop="purgeMediaProgress">Purge Media Progress</ui-btn>
        </div>

        <table v-if="mediaProgressWithMedia.length" class="userAudiobooksTable">
          <tr class="bg-primary bg-opacity-40">
            <th class="w-16 text-left">Item</th>
            <th class="text-left"></th>
            <th class="w-32">Progress</th>
            <th class="w-40 hidden sm:table-cell">Started At</th>
            <th class="w-40 hidden sm:table-cell">Last Update</th>
          </tr>
          <tr v-for="item in mediaProgressWithMedia" :key="item.id" :class="!item.isFinished ? '' : 'isFinished'">
            <td>
              <covers-book-cover :width="50" :library-item="item" :book-cover-aspect-ratio="bookCoverAspectRatio" />
            </td>
            <td class="font-book">
              <template v-if="item.media && item.media.metadata && item.episode">
                <p>{{ item.episode.title || 'Unknown' }}</p>
                <p class="text-white text-opacity-50 text-sm font-sans">{{ item.media.metadata.title }}</p>
              </template>
              <template v-else-if="item.media && item.media.metadata">
                <p>{{ item.media.metadata.title || 'Unknown' }}</p>
                <p v-if="item.media.metadata.authorName" class="text-white text-opacity-50 text-sm font-sans">by {{ item.media.metadata.authorName }}</p>
              </template>
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
      listeningStats: {},
      purgingMediaProgress: false
    }
  },
  computed: {
    userToken() {
      return this.user.token
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
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
    mediaProgressWithMedia() {
      return this.mediaProgress.filter((mp) => mp.media)
    },
    mediaProgressWithoutMedia() {
      return this.mediaProgress.filter((mp) => !mp.media)
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
      this.listeningSessions = await this.$axios
        .$get(`/api/users/${this.user.id}/listening-sessions?page=0&itemsPerPage=10`)
        .then((data) => {
          return data.sessions || []
        })
        .catch((err) => {
          console.error('Failed to load listening sesions', err)
          return []
        })
      this.listeningStats = await this.$axios.$get(`/api/users/${this.user.id}/listening-stats`).catch((err) => {
        console.error('Failed to load listening sesions', err)
        return []
      })
      console.log('Loaded user listening data', this.listeningSessions, this.listeningStats)
    },
    purgeMediaProgress() {
      this.purgingMediaProgress = true

      this.$axios
        .$post(`/api/users/${this.user.id}/purge-media-progress`)
        .then((updatedUser) => {
          console.log('Updated user', updatedUser)
          this.$toast.success('Media progress purged')
          this.user = updatedUser
        })
        .catch((error) => {
          console.error('Failed to purge media progress', error)
          this.$toast.error('Failed to purge media progress')
        })
        .finally(() => {
          this.purgingMediaProgress = false
        })
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