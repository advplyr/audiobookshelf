<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-semibold mb-4">Recommendations · Sent</h1>

    <div v-if="loading" class="text-gray-300">Loading…</div>
    <div v-else-if="!items.length" class="text-gray-400">You haven’t sent any recommendations yet.</div>

    <div v-else class="space-y-3">
      <div v-for="r in items" :key="r.id" class="border border-gray-700 rounded-md p-3">
        <div class="flex items-center text-sm text-gray-400 mb-1">
          <div class="truncate">
            to <span class="text-gray-200">{{ r.recipient?.username || 'Public' }}</span>
            <span class="text-gray-500"> • {{ fmt(r.createdAt) }}</span>
            <span
              class="ml-2 text-xs px-2 py-0.5 border rounded-full"
              :class="r.visibility === 'public' ? 'border-primary text-primary' : 'border-gray-500 text-gray-400'"
            >{{ r.visibility }}</span>
          </div>
          <button
            class="ml-auto text-xs px-2 py-1 rounded border border-error/60 text-error hover:bg-error/10 disabled:opacity-50"
            :disabled="!!deleting[r.id]"
            @click="confirmDelete(r)"
          >{{ deleting[r.id] ? 'Deleting…' : 'Delete' }}</button>
        </div>

        <div class="flex items-start">
          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-gray-500 mr-2">
            {{ r.tag?.label || 'Recommended' }}
          </span>
          <div class="text-sm text-gray-200">
            <span class="block">{{ r.bookTitle || `Book #${r.bookId}` }}</span>
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
      const items = await app.$axios.$get('/api/recommendations/sent?include=tag,recipient,item')
      return { items, loading: false }
    } catch {
      return { items: [], loading: false }
    }
  },
  data: () => ({ loading: true, items: [], deleting: {} }),
  computed: {
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat') || 'yyyy-MM-dd'
    }
  },
  methods: {
    fmt(v) {
      try { return this.$formatDate(v, this.dateFormat) }
      catch { return new Date(v).toLocaleString() }
    },
    async confirmDelete(r) {
      if (!window.confirm('Delete this recommendation?')) return
      await this.del(r.id)
    },
    async del(id) {
      if (this.deleting[id]) return
      this.$set(this.deleting, id, true)
      try {
        await this.$axios.$delete(`/api/recommendations/${id}`)
        this.items = this.items.filter((i) => i.id !== id)
        this.$toast?.success('Recommendation deleted')
      } catch (e) {
        this.$toast?.error(e?.response?.data?.message || 'Failed to delete recommendation')
      } finally {
        this.$delete(this.deleting, id)
      }
    }
  }
}
</script>
