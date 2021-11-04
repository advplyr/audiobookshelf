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
      <div class="w-full h-px bg-white bg-opacity-10 my-2" />
      <div class="py-2">
        <h1 class="text-lg mb-2 text-white text-opacity-90 px-2 sm:px-0">Reading Progress</h1>
        <table v-if="userAudiobooks.length" class="userAudiobooksTable">
          <tr class="bg-primary bg-opacity-40">
            <th class="w-16 text-left">Book</th>
            <th class="text-left"></th>
            <th class="w-32">Progress</th>
            <th class="w-40 hidden sm:table-cell">Started At</th>
            <th class="w-40 hidden sm:table-cell">Last Update</th>
          </tr>
          <tr v-for="ab in userAudiobooks" :key="ab.audiobookId" :class="!ab.isRead ? '' : 'isRead'">
            <td>
              <cards-book-cover :width="50" :audiobook="ab" />
            </td>
            <td class="font-book">
              <p>{{ ab.book ? ab.book.title : ab.audiobookTitle || 'Unknown' }}</p>
              <p v-if="ab.book && ab.book.author" class="text-white text-opacity-50 text-sm font-sans">by {{ ab.book.author }}</p>
            </td>
            <td class="text-center">{{ Math.floor(ab.progress * 100) }}%</td>
            <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="ab.startedAt" direction="top" :text="$formatDate(ab.startedAt, 'MMMM do, yyyy HH:mm')">
                <p class="text-sm">{{ $dateDistanceFromNow(ab.startedAt) }}</p>
              </ui-tooltip>
            </td>
            <td class="text-center hidden sm:table-cell">
              <ui-tooltip v-if="ab.lastUpdate" direction="top" :text="$formatDate(ab.lastUpdate, 'MMMM do, yyyy HH:mm')">
                <p class="text-sm">{{ $dateDistanceFromNow(ab.lastUpdate) }}</p>
              </ui-tooltip>
            </td>
          </tr>
        </table>
        <p v-else class="text-white text-opacity-50">Nothing read yet...</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ params, redirect, app }) {
    var user = await app.$axios.$get(`/api/user/${params.id}`).catch((error) => {
      console.error('Failed to get user', error)
      return null
    })
    if (!user) return redirect('/config/users')
    return {
      user
    }
  },
  data() {
    return {}
  },
  computed: {
    username() {
      return this.user.username
    },
    userOnline() {
      return this.$store.getters['users/getIsUserOnline'](this.user.id)
    },
    userAudiobooks() {
      return Object.values(this.user.audiobooks || {}).sort((a, b) => b.lastUpdate - a.lastUpdate)
    }
  },
  methods: {},
  mounted() {}
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
.userAudiobooksTable tr.isRead {
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