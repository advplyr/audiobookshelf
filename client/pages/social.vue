<template>
  <div class="w-full h-full overflow-y-auto px-2 py-18 md:p-8">
    <div class="flex flex-col md:flex-row">
      <div class="w-200 my-6 mx-auto">
        <div class="grid grid-cols-2 content-between">
          <h1 class="text-2xl mb-4 font-book">Social</h1>
          <div class="flex py-1 justify-end">
            <ui-tooltip text="Share your latest listening activity with other users in the social tab">
              <p class="pl-4">
                Share Listening Activity
                <span class="material-icons icon-text text-sm">info_outlined</span>
              </p>
            </ui-tooltip>
            <ui-toggle-switch v-model="isSharingActivity" @input="changeSharingSetting" />
          </div>
        </div>
        <p v-if="!users.length">No Other User Sessions</p>
        <template v-for="(user, num) in users">
          <div :key="user.username" class="w-full py-0.5">
            <div class="flex items-center mb-1">
              <nuxt-link :to="`/item/${user.latest.libraryItemId}`">
                <ui-tooltip direction="left" :text="Math.round(user.latest.progress * 100) + '%'">
                  <covers-book-cover class="absolute left-0 right-0" :library-item="user.libraryItem" :width="bookCoverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
                </ui-tooltip>
              </nuxt-link>
              <p class="text-lg px-2 font-book text-white">{{ user.username }}&nbsp;</p>
              <div class="">
                <p class="text-xs text-white text-opacity-50">{{user.latest.lastUpdate != null ? "Last listened " + $dateDistanceFromNow(user.latest.lastUpdate) : "Never listened" }}</p>
              </div>
              <div class="flex-grow" />
              <div class="w-30 text-right">
                <p class="text-sm font-bold">{{ user.minutesListened > 0 ? "Has listened for " + $elapsedPrettyExtended(user.minutesListened) : "No listening time" }}</p>
              </div>
              <widgets-online-indicator class="mx-2" :value="!!usersOnline[user.id]" />
            </div>
            <div v-if="num+1 < users.length" class="flex border-t border-white border-opacity-10 my-3"/>
          </div>
        </template>
      </div>
    </div>
    <div class="h-16" />
  </div>
</template>

<script>
import BookCover from '../components/covers/BookCover.vue'
import Cover from '../components/modals/item/tabs/Cover.vue'
export default {
  components: { Cover },
  data() {
    return {
      listeningStats: null
    }
  },
  computed: {
    coverAspectRatio() {
      return this.$store.getters['getServerSetting']('coverAspectRatio')
    },
    bookCoverAspectRatio() {
      return this.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE ? 1 : 1.6
    },
    bookCoverWidth() {
      return 70
    },
    users() {
      if (!this.listeningStats) return []
      return this.listeningStats.filter(c => c.latest)
    },
    userMediaProgress() {
      return this.user.mediaProgress || []
    },
    userItemsFinished() {
      if (!this.listeningStats) return []
      return this.listeningStats.itemsRead
    },
    mostRecentListeningSessions() {
      if (!this.listeningStats) return []
      return this.listeningStats.recentSessions || []
    },
    totalMinutesListening() {
      if (!this.listeningStats) return 0
      return Math.round(this.listeningStats.totalTime / 60)
    },
    totalDaysListened() {
      if (!this.listeningStats) return 0
      return Object.values(this.listeningStats.days).length
    },
    usersOnline() {
      var usermap = {}
      this.$store.state.users.users.forEach((u) => (usermap[u.id] = { online: true, session: u.session }))
      return usermap
    },
    isSharingActivity() {
      return this.$store.getters['user/getUserSetting']('shareListeningActivity')
    }
  },
  methods: {
    async init() {
      let listeningStats = await this.$axios.$get(`/api/social`).catch((err) => {
        console.error('Failed to load shared user listening sesions', err)
        return []
      })
      for (let i = 0; i < listeningStats.length; i++) {
        if (listeningStats[i].latest != null) {
        listeningStats[i].libraryItem = await this.$axios
          .$get(`/api/items/${listeningStats[i].latest.libraryItemId}`)
          .catch((error) => {
            console.error('Failed', error)
          })
        }
      }
      console.log('Loaded users shared listening data', listeningStats)
      this.listeningStats = listeningStats
    },
   async getLibraryItem(user) {
      user.libraryItem = await this.$axios
        .$get(`/api/items/${id}`)
        .catch((error) => {
          console.error('Failed', error)
          return false
        })
    },
    changeSharingSetting() {
      console.log('test')
      console.log(String(!this.isSharingActivity))
      this.$store.dispatch('user/updateUserSettings', { shareListeningActivity: !this.isSharingActivity })
      this.init()
    }
  },
  mounted() {
    this.init()
  }
}
</script>
