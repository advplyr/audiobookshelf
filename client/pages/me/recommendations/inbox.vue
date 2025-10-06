<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-semibold mb-4">Recommendations · Inbox</h1>

    <div v-if="loading" class="text-gray-300">Loading…</div>
    <div v-else-if="!items.length" class="text-gray-400">You have no incoming recommendations yet.</div>

    <div v-else class="space-y-3">
      <div v-for="r in items" :key="r.id" class="border border-gray-700 rounded-md p-3">
        <div class="text-sm text-gray-400 mb-1 flex items-center">
          <div>
            from <span class="text-gray-200">{{ r.recommender?.username || 'Someone' }}</span>
            <span class="text-gray-500"> • {{ fmt(r.createdAt) }}</span>
          </div>
          <nuxt-link class="ml-auto text-xs px-2 py-1 rounded bg-primary text-white border border-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40" :to="itemLink(r)"> Go to </nuxt-link>
        </div>

        <div class="flex items-start">
          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-gray-500 mr-2">
            {{ r.tag?.label || 'Recommended' }}
          </span>
          <div class="text-sm text-gray-200">
            <span>{{ r.bookTitle || `Book #${r.bookId}` }}</span>
            <span v-if="r.note" class="block text-gray-300 mt-1">{{ r.note }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  middleware: 'authenticated',
  async asyncData({ store, app, route, redirect }) {
    if (!store.state.user.user) return redirect(`/login?redirect=${route.path}`)
    try {
      const items = await app.$axios.$get('/api/recommendations/inbox?include=tag,recommender,item')
      return { items, loading: false }
    } catch (_) {
      return { items: [], loading: false }
    }
  },
  data: () => ({ loading: true, items: [] }),
  computed: {
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat') || 'yyyy-MM-dd'
    }
  },
  methods: {
    fmt(v) {
      try {
        return this.$formatDate(v, this.dateFormat)
      } catch {
        return new Date(v).toLocaleString()
      }
    },
    itemLink(r) {
      const id = r?.item?.id || r.bookId
      return `/item/${id}`
    }
  }
}
</script>
