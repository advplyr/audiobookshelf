<template>
  <div v-if="enabled">
    <button class="rounded px-3 py-1 text-sm bg-primary text-white border border-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40" @click="onClick">Recommend</button>

    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/60" @click="close"></div>

      <div class="relative z-10 w-full max-w-md rounded-md border border-gray-700 bg-bg p-4">
        <div class="flex items-center mb-3">
          <h3 class="text-lg font-semibold">Recommend this</h3>
          <button class="ml-auto text-gray-400 hover:text-gray-200" @click="close" aria-label="Close">✕</button>
        </div>

        <div v-if="tagsLoading" class="text-gray-400">Loading tags…</div>
        <div v-else>
          <label class="block text-sm mb-1">Tag</label>
          <select v-model="form.tagId" class="w-full mb-3 rounded border px-2 py-1 bg-[#111827] text-gray-100 border-gray-600" style="color-scheme: dark">
            <option disabled value="">Select a tag…</option>
            <option v-for="t in tags" :key="t.id" :value="t.id" class="bg-[#111827] text-gray-100">
              {{ t.label }}
            </option>
          </select>

          <label class="block text-sm mb-1">Visibility</label>
          <select v-model="form.visibility" class="w-full mb-3 rounded border px-2 py-1 bg-[#111827] text-gray-100 border-gray-600" style="color-scheme: dark">
            <option value="public">public</option>
            <option value="recipient-only">recipient-only</option>
          </select>

          <label class="block text-sm mb-1">Note <span class="opacity-60">(optional)</span></label>
          <textarea v-model="form.note" rows="3" maxlength="1000" class="w-full rounded border border-gray-600 bg-transparent px-2 py-1" placeholder="Why should someone read/listen to this?"></textarea>

          <div class="mt-4 flex items-center gap-2">
            <button :disabled="submitting || !form.tagId" class="rounded px-3 py-1 text-sm bg-primary text-white border border-primary hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40" @click="submit">
              {{ submitting ? 'Posting…' : 'Post recommendation' }}
            </button>
            <span v-if="error" class="text-sm text-error">{{ error }}</span>
            <span v-if="ok" class="text-sm text-success">Posted</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RecommendButton',
  props: { bookId: { type: String, required: true } },
  data: () => ({
    enabled: false,
    user: null,
    open: false,
    tags: [],
    tagsLoading: false,
    submitting: false,
    ok: false,
    error: '',
    form: { tagId: '', visibility: 'public', note: '' }
  }),
  mounted() {
    const flag = this.$store.getters['getServerSetting']?.('recommendationsEnabled')
    this.enabled = !!flag
    this.user = this.$store?.state?.user?.user || null

    if (!this.enabled) {
      this.$axios
        .$get('/api/recommendations/tags')
        .then(() => {
          this.enabled = true
        })
        .catch(() => {
          this.enabled = false
        })
    }
  },
  methods: {
    async onClick() {
      if (!this.enabled) return

      if (!this.user) {
        const back = encodeURIComponent(this.$route.fullPath)
        return this.$router.push(`/login?redirect=${back}`)
      }
      this.open = true
      this.ok = false
      this.error = ''
      if (!this.tags.length) {
        this.tagsLoading = true
        try {
          this.tags = await this.$axios.$get('/api/recommendations/tags')
        } catch (e) {
          this.error = e?.response?.data?.message || 'Failed to load tags'
        } finally {
          this.tagsLoading = false
        }
      }
    },
    close() {
      this.open = false
      this.form = { tagId: '', visibility: 'public', note: '' }
      this.error = ''
      this.ok = false
    },
    async submit() {
      if (!this.form.tagId) return
      this.submitting = true
      this.error = ''
      this.ok = false
      try {
        const payload = {
          bookId: this.bookId,
          tagId: this.form.tagId,
          note: this.form.note || '',
          visibility: this.form.visibility
        }
        const created = await this.$axios.$post('/api/recommendations', payload)
        this.$emit('recommended', created)
        this.ok = true
        this.$toast?.success?.('Recommendation posted')
        setTimeout(() => this.close(), 700)
      } catch (e) {
        this.error = e?.response?.data?.message || 'Failed to post'
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>
