<template>
  <div id="page-wrapper" class="page overflow-y-auto p-4 md:p-8" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="max-w-6xl mx-auto">
      <h1 class="text-3xl font-semibold">{{ $strings.HeaderCommunity }}</h1>
      <div v-if="stats" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div class="bg-primary rounded-lg p-5"><p class="text-gray-300">{{ $strings.LabelTotalListeningTime }}</p><p class="text-2xl mt-1">{{ $elapsedPretty(stats.totalListeningTime) }}</p></div>
        <div class="bg-primary rounded-lg p-5"><p class="text-gray-300">{{ $strings.LabelListeners }}</p><p class="text-2xl mt-1">{{ stats.listenerCount }}</p></div>
        <div class="bg-primary rounded-lg p-5"><p class="text-gray-300">{{ $strings.LabelTopAuthors }}</p><p class="text-sm mt-1">{{ stats.topAuthors.map(a => a.name).join(', ') || '—' }}</p></div>
      </div>
      <section v-if="stats" class="mt-8">
        <h2 class="text-xl font-semibold">{{ $strings.LabelMostListenedBooks }}</h2>
        <div class="flex gap-4 overflow-x-auto mt-3 pb-2">
          <nuxt-link v-for="book in stats.mostListenedBooks" :key="book.id" :to="`/item/${book.id}`" class="w-32 shrink-0">
            <img :src="book.cover" :alt="book.title" class="w-32 h-48 object-cover rounded bg-primary" />
            <p class="text-sm mt-2 line-clamp-2">{{ book.title }}</p><p class="text-xs text-gray-400">{{ book.listenerCount }} {{ $strings.LabelListeners }}</p>
          </nuxt-link>
        </div>
      </section>
      <div v-if="stats" class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <section><h2 class="text-xl font-semibold">{{ $strings.LabelMostActiveListeners }}</h2><div v-for="listener in stats.mostActiveListeners" :key="listener.userId" class="flex justify-between border-b border-white/10 py-3"><span>{{ listener.username }}</span><span class="text-gray-400">{{ $elapsedPretty(listener.timeListening) }}</span></div></section>
        <section><h2 class="text-xl font-semibold">{{ $strings.LabelRecentActivity }}</h2><div v-for="event in activity.events" :key="event.id" class="flex gap-3 border-b border-white/10 py-3"><img :src="event.cover" class="w-10 h-14 object-cover rounded" alt="" /><div><p><b>{{ event.username }}</b> · {{ event.itemTitle }}</p><p class="text-xs text-gray-400">{{ $elapsedPretty(event.timeListening) }} · {{ $dateDistanceFromNow(event.timestamp) }}</p></div></div><div v-if="activity.numPages > 1" class="flex justify-end gap-2 mt-3"><ui-btn small :disabled="page === 0" @click="loadPage(page - 1)">‹</ui-btn><span class="py-2">{{ page + 1 }} / {{ activity.numPages }}</span><ui-btn small :disabled="page + 1 >= activity.numPages" @click="loadPage(page + 1)">›</ui-btn></div></section>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ app, params, store, redirect }) {
    if (!store.getters['getServerSetting']('enableCommunityListeningStats')) return redirect(`/library/${params.library}`)
    const [stats, activity] = await Promise.all([app.$axios.$get(`/api/libraries/${params.library}/community-stats`), app.$axios.$get(`/api/libraries/${params.library}/community-activity?page=0&itemsPerPage=20`)])
    return { stats, activity }
  },
  data: () => ({ stats: null, activity: { events: [], numPages: 0 }, page: 0 }),
  computed: {
    streamLibraryItem() { return this.$store.state.streamLibraryItem },
    libraryId() { return this.$route.params.library }
  },
  methods: {
    async loadPage(page) {
      this.activity = await this.$axios.$get(`/api/libraries/${this.libraryId}/community-activity?page=${page}&itemsPerPage=20`)
      this.page = page
    }
  }
}
</script>
