<template>
  <div class="w-full h-full overflow-y-auto px-2 py-18 md:p-8">
    <div v-if="this.listeningStats" class="flex flex-col md:flex-row">
      <div class="w-200 my-6 mx-auto">
        <div class="grid grid-cols-2 content-between">
          <h1 class="text-2xl mb-4 font-book">{{ $strings.Social }}</h1>
          <div class="flex py-1 justify-end">
            <ui-tooltip :text="$strings.ShareStatsHelp">
              <p class="pl-4">
                {{ $strings.ShareStats }}
                <span class="material-icons icon-text text-sm">info_outlined</span>
              </p>
            </ui-tooltip>
            <ui-toggle-switch v-model="isUserSharing" @input="changeSharingSetting" />
          </div>
        </div>
        <p v-if="!users.length">No Other User Sessions</p>
        <template v-for="(user, num) in users">
          <div :key="user.username" class="w-full">
            <div class="flex items-center mb-1">
              <nuxt-link :to="`/item/${user.latest.progress.libraryItemId}`">
                <ui-tooltip direction="left" :text="Math.round(user.latest.progress.progress * 100) + '%'">
                  <covers-book-cover class="absolute left-0 right-0" :library-item="user.latest.item" :width="bookCoverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
                </ui-tooltip>
              </nuxt-link>
              <p class="text-xs pl-2 text-white text-opacity-50">{{ "Last listened to " + user.latest.item.media.metadata.title + " " + $dateDistanceFromNow(user.latest.progress.lastUpdate) + " for " + $elapsedPrettyExtended(user.latest.progress.duration) }}</p>
              <div class="flex-grow" />
              <p class="text-lg pl-2 font-book text-white">{{ user.username }}</p>
              <widgets-online-indicator class="mx-2" :value="!!usersOnline[user.id]" />
            </div>
            <div v-if="num+1 < users.length" class="flex border-t border-white border-opacity-10 my-3"/>
          </div>
        </template>
      </div>
    </div>
    <div v-else>
      <p class="text-xl text-center">There is no listening activity to display</p>
    </div>
  </div>
</template>

<script>
import Cover from '../components/modals/item/tabs/Cover.vue'
export default {
  components: { Cover },
  data() {
    return {
      listeningStats: null,
      isUserSharing: null
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    bookCoverWidth() {
      return 70
    },
    users() {
      if (!this.listeningStats) return []
      return this.listeningStats.sort(function(a, b) {return b.latest.progress.lastUpdate - a.latest.progress.lastUpdate})
    },
    usersOnline() {
      var usermap = {}
      this.$store.state.users.users.forEach((u) => (usermap[u.id] = { online: true, session: u.session }))
      return usermap
    }
  },
  methods: {
    init() {
      this.getUserSharing()
      this.loadStats()
    },
    getUserSharing() {
      this.isUserSharing = this.$store.getters['user/getUserSetting']('shareListeningActivity')
    },
    async loadStats() {
      let listeningStats = await this.$axios.$get(`/api/social`).catch((err) => {
        console.error('Failed to load shared user listening sesions', err)
        return []
      })
      this.listeningStats = listeningStats
    },
    changeSharingSetting() {
      this.$store.dispatch('user/updateUserSettings', { shareListeningActivity: this.isUserSharing})
      this.loadStats()
    }
  },
  mounted() {
    this.init()
  }
}
</script>
