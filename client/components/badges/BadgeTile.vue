<template>
  <div class="rounded-2xl bg-bg/60 border border-primary/20 p-3 flex flex-col items-center text-center">
    <img
      :src="src"
      alt=""
      class="w-20 h-20 object-contain select-none"
      :class="locked ? 'filter grayscale opacity-60' : ''"
      @error="onImgError"
      draggable="false"
    />
    <div class="mt-2">
      <p class="text-sm font-medium">{{ badge.name }}</p>
      <p v-if="badge.blurb" class="text-xxs text-gray-400 mt-0.5">{{ badge.blurb }}</p>
    </div>
    <div v-if="!locked" class="mt-1 text-xxs text-green-400">Unlocked ✓</div>
  </div>
</template>

<script>
export default {
  props: {
    badge: { type: Object, required: true },
    locked: { type: Boolean, default: true }
  },
  data () {
    return { imgError: false }
  },
  computed: {
    src () {
      if (this.imgError) {
        // Simple inline SVG placeholder
        return `data:image/svg+xml;utf8,` + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="#1f2937"/><text x="50%" y="52%" fill="#9ca3af" font-size="12" text-anchor="middle" font-family="sans-serif">${this.badge.name}</text></svg>`
        )
      }
      // your files are under /static/badges and named like new_reader.png etc.
      return `/badges/${this.badge.id}.png`
    }
  },
  methods: {
    onImgError () { this.imgError = true }
  }
}
</script>
