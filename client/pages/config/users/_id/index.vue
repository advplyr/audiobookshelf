<template>
  <div class="w-full h-full">
    <div class="bg-bg rounded-md shadow-lg border border-white/5 p-0 sm:p-4 mb-8">
      <nuxt-link to="/config/users" class="text-white/70 hover:text-white/100 hover:bg-white/5 cursor-pointer rounded-full px-2 sm:px-0">
        <div class="flex items-center">
          <div class="h-10 w-10 flex items-center justify-center">
            <span class="material-symbols text-2xl">arrow_back</span>
          </div>
          <p class="pl-1">{{ $strings.LabelAllUsers }}</p>
        </div>
      </nuxt-link>
      <div class="flex items-center mb-2 mt-4 px-2 sm:px-0">
        <widgets-online-indicator :value="!!userOnline" />
        <h1 class="text-xl pl-2">{{ username }}</h1>
      </div>
      <div v-if="legacyToken" class="text-xs space-y-2 mt-4">
        <ui-text-input-with-label label="Legacy API Token" :value="legacyToken" readonly show-copy />

        <p class="text-warning" v-html="$strings.MessageAuthenticationLegacyTokenWarning" />
      </div>
      <div class="w-full h-px bg-white/10 my-2" />
      <div class="py-2">
        <h1 class="text-lg mb-2 text-white/90 px-2 sm:px-0">{{ $strings.HeaderListeningStats }}</h1>
        <div class="flex items-center">
          <p class="text-sm text-gray-300">{{ listeningSessions.total }} {{ $strings.HeaderListeningSessions }}</p>
          <ui-btn :to="`/config/users/${user.id}/sessions`" class="text-xs mx-2" :padding-x="1.5" :padding-y="1">{{ $strings.ButtonViewAll }}</ui-btn>
        </div>
        <p class="text-sm text-gray-300">
          {{ $strings.LabelTotalTimeListened }}:&nbsp;
          <span class="font-mono text-base">{{ listeningTimePretty }}</span>
        </p>
        <p v-if="timeListenedToday" class="text-sm text-gray-300">
          {{ $strings.LabelTimeListenedToday }}:&nbsp;
          <span class="font-mono text-base">{{ $elapsedPrettyExtended(timeListenedToday) }}</span>
        </p>

        <div v-if="latestSession" class="mt-4">
          <h1 class="text-lg mb-2 text-white/90 px-2 sm:px-0">{{ $strings.HeaderLastListeningSession }}</h1>
          <p class="text-sm text-gray-300">
            <strong>{{ latestSession.displayTitle }}</strong> {{ $dateDistanceFromNow(latestSession.updatedAt) }} for <span class="font-mono text-base">{{ $elapsedPrettyExtended(this.latestSession.timeListening) }}</span>
          </p>
        </div>
      </div>
      <div class="w-full h-px bg-white/10 my-2" />
      <div class="py-2">
        <h1 class="text-lg mb-2 text-white/90 px-2 sm:px-0">{{ $strings.HeaderSavedMediaProgress }}</h1>

        <table v-if="mediaProgress.length" class="userAudiobooksTable">
          <tr class="bg-primary/40">
            <th class="w-16 text-left">{{ $strings.LabelItem }}</th>
            <th class="text-left"></th>
            <th class="w-32">{{ $strings.LabelProgress }}</th>
            <th class="w-40 hidden sm:table-cell">{{ $strings.LabelStartedAt }}</th>
            <th class="w-40 hidden sm:table-cell">{{ $strings.LabelLastUpdate }}</th>
          </tr>
          <tr v-for="item in mediaProgress" :key="item.id" :class="!item.isFinished ? '' : 'isFinished'">
            <td>
              <covers-preview-cover v-if="item.coverPath" :width="50" :src="$store.getters['globals/getLibraryItemCoverSrcById'](item.libraryItemId, item.mediaUpdatedAt)" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" />
              <div v-else class="bg-primary flex items-center justify-center text-center text-xs text-gray-400 p-1" :style="{ width: '50px', height: 50 * bookCoverAspectRatio + 'px' }">No Cover</div>
            </td>
            <td>
              <p>{{ item.displayTitle || 'Unknown' }}</p>
              <p v-if="item.displaySubtitle" class="text-white/50 text-sm font-sans">{{ item.displaySubtitle }}</p>
            </td>
            <td class="text-center">
              <p class="text-sm">{{ Math.floor(item.progress * 100) }}%</p>
            </td>
            <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="item.startedAt" direction="top" :text="$formatDatetime(item.startedAt, dateFormat, timeFormat)">
                <p class="text-sm">{{ $dateDistanceFromNow(item.startedAt) }}</p>
              </ui-tooltip>
            </td>
            <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="item.lastUpdate" direction="top" :text="$formatDatetime(item.lastUpdate, dateFormat, timeFormat)">
                <p class="text-sm">{{ $dateDistanceFromNow(item.lastUpdate) }}</p>
              </ui-tooltip>
            </td>
          </tr>
        </table>
        <p v-else class="text-white/50">{{ $strings.MessageNoMediaProgress }}</p>
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
      listeningSessions: {},
      listeningStats: {}
    }
  },
  computed: {
    legacyToken() {
      return this.user.token
    },
    userToken() {
      return this.user.accessToken
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
      if (!this.listeningSessions.sessions || !this.listeningSessions.sessions.length) return null
      return this.listeningSessions.sessions[0]
    },
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    },
    timeFormat() {
      return this.$store.getters['getServerSetting']('timeFormat')
    }
  },
  methods: {
    async init() {
      this.listeningSessions = await this.$axios
        .$get(`/api/users/${this.user.id}/listening-sessions?page=0&itemsPerPage=10`)
        .then((data) => {
          return data || {}
        })
        .catch((err) => {
          console.error('Failed to load listening sesions', err)
          return {}
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
