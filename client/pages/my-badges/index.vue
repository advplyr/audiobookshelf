<template>
  <div class="px-6 py-4">
    <h1 class="text-2xl font-semibold mb-4">My Badges</h1>

    <div v-if="error" class="text-error mb-4">{{ error }}</div>

    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-300">
        {{ catalogLoaded ? 'Choose a collection to explore your badges.' : 'Loading…' }}
      </p>
      <p v-if="catalogLoaded" class="text-sm text-gray-300">
        Progress: <span class="font-semibold">{{ unlockedCount }}</span> unlocked
      </p>
    </div>

    <div v-if="catalogLoaded" class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <CollectionCard
        v-for="c in catalog.collections"
        :key="c.id"
        :title="c.name"
        :count="c.badgeIds.length"
        :to="`/my-badges/${c.id}`"
      />
    </div>
  </div>
</template>

<script>
import AchievementService from '@/services/AchievementService'
import CollectionCard from '@/components/badges/CollectionCard.vue'

export default {
  components: { CollectionCard },
  data () {
    return {
      catalog: null,
      my: { userId: 'guest', counters: {}, unlocked: [], history: [] },
      error: '',
      unlisten: null
    }
  },
  computed: {
    catalogLoaded () { return !!this.catalog },
    // Defensive: only count IDs that exist in the catalog (avoids mismatch)
    unlockedCount () {
      if (!this.catalog) return 0
      const valid = new Set(Object.keys(this.catalog.badges || {}))
      return (this.my?.unlocked || []).filter(id => valid.has(id)).length
    }
  },
  async mounted () {
    await this.load()
    // keep progress fresh when a badge is unlocked elsewhere
    const onUnlocked = async () => {
      try { this.my = await AchievementService.getMy() } catch (_) {}
    }
    window.addEventListener('achievement:unlocked', onUnlocked)
    this.unlisten = () => window.removeEventListener('achievement:unlocked', onUnlocked)
  },
  beforeDestroy () { if (this.unlisten) this.unlisten() },
  methods: {
    async load () {
      try {
        const [catalog, my] = await Promise.all([
          AchievementService.getCatalog(),
          AchievementService.getMy()
        ])
        this.catalog = catalog
        this.my = my || this.my
      } catch (e) {
        this.error = e?.message || 'Failed to load achievements'
        if (!this.catalog) {
          try { this.catalog = await AchievementService.getCatalog() } catch (_) {}
        }
        if (!this.my) this.my = { userId: 'guest', counters: {}, unlocked: [], history: [] }
      }
    }
  }
}
</script>
