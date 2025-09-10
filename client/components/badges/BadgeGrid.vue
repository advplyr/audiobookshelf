<template>
  <div class="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
    <BadgeTile
      v-for="b in badges"
      :key="b.id"
      :badge="b"
      :locked="!unlockedIdsSet.has(b.id)"
    />
  </div>
</template>

<script>
import BadgeTile from './BadgeTile.vue'

export default {
  components: { BadgeTile },
  props: {
    badges: { type: Array, required: true },
    unlockedIds: { type: [Array, Set], default: () => [] }
  },
  computed: {
    unlockedIdsSet () { return this.unlockedIds instanceof Set ? this.unlockedIds : new Set(this.unlockedIds) }
  }
}
</script>
