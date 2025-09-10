<template>
  <div class="px-6 py-4">
    <div class="flex items-center gap-3 mb-4">
      <nuxt-link to="/my-badges" class="text-primary hover:underline text-sm">← All Collections</nuxt-link>
      <h1 class="text-2xl font-semibold">{{ title }}</h1>
      <span v-if="ready && collection" class="text-sm text-gray-400 ml-auto">
        {{ unlockedInThis }}/{{ totalInThis }} unlocked
      </span>
    </div>

    <div v-if="error" class="text-error mb-4">{{ error }}</div>
    <div v-else-if="!ready" class="text-gray-300">Loading…</div>
    <div v-else-if="!collection" class="text-gray-300">Collection not found.</div>
    <div v-else>
      <BadgeGrid :badges="badgesInCollection" :unlocked-ids="unlockedSet" />
    </div>
  </div>
</template>

<script>
import AchievementService from '@/services/AchievementService'
import BadgeGrid from '@/components/badges/BadgeGrid.vue'

export default {
  components: { BadgeGrid },
  data () {
    return {
      catalog: null,
      my: { unlocked: [] },
      collection: null,
      error: '',
      unlisten: null
    }
  },
  computed: {
    ready () { return !!this.catalog },
    title () { return this.collection?.name || 'Reading Journey' },
    badgesInCollection () {
      if (!this.collection || !this.catalog) return []
      // catalog.badges is an object keyed by id
      return (this.collection.badgeIds || [])
        .map(id => this.catalog.badges[id])
        .filter(Boolean)
    },
    unlockedSet () {
      return new Set(this.my?.unlocked || [])
    },
    unlockedInThis () {
      const ids = new Set(this.collection?.badgeIds || [])
      let n = 0
      for (const id of this.my?.unlocked || []) if (ids.has(id)) n++
      return n
    },
    totalInThis () {
      return this.collection?.badgeIds?.length || 0
    }
  },
  watch: {
    '$route.params.collectionId': {
      immediate: true,
      async handler () {
        await this.load()
      }
    }
  },
  mounted () {
    // If a badge is unlocked elsewhere, refresh progress so tiles flip to color
    const onUnlocked = async () => {
      try { this.my = await AchievementService.getMy() } catch (_) {}
    }
    window.addEventListener('achievement:unlocked', onUnlocked)
    this.unlisten = () => window.removeEventListener('achievement:unlocked', onUnlocked)
  },
  beforeDestroy () {
    if (this.unlisten) this.unlisten()
  },
  methods: {
    async load () {
      this.error = ''
      try {
        const [catalog, my] = await Promise.all([
          AchievementService.getCatalog(),
          AchievementService.getMy()
        ])
        this.catalog = catalog
        this.my = my || { unlocked: [] }
        const cid = this.$route.params.collectionId
        this.collection = this.catalog.collections.find(c => c.id === cid)
      } catch (e) {
        this.error = e?.message || 'Failed to load collection'
      }
    }
  }
}
</script>
