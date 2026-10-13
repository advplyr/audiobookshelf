<template>
  <div role="radiogroup" :aria-label="$strings.HeaderTheme" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <button v-for="theme in themes" :key="theme.id" type="button" role="radio" :aria-checked="theme.id === current" class="group relative text-left rounded-xl border p-2 transition-colors" :class="theme.id === current ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/25'" @click="select(theme.id)">
      <div class="relative h-16 rounded-lg overflow-hidden" :style="{ backgroundColor: theme.swatch.bg }">
        <div class="absolute left-0 top-0 bottom-0 w-5" :style="{ backgroundColor: theme.swatch.surface }" />
        <div class="absolute left-7 top-3 w-8 h-10 rounded-sm" :style="{ backgroundColor: theme.swatch.surface }" />
        <div class="absolute left-[4.25rem] top-3 w-8 h-10 rounded-sm" :style="{ backgroundColor: theme.swatch.surface }" />
        <div class="absolute left-7 right-3 bottom-2 h-1 rounded-full bg-white/10">
          <div class="h-full w-2/5 rounded-full" :style="{ backgroundColor: theme.swatch.accent }" />
        </div>
        <div class="absolute right-3 top-3 w-5 h-5 rounded-full" :style="{ backgroundColor: theme.swatch.accent }" />
      </div>
      <div class="flex items-center justify-between px-1 pt-2">
        <span class="text-sm" :class="theme.id === current ? 'text-white' : 'text-gray-300'">{{ $strings[theme.labelKey] }}</span>
        <span v-if="theme.id === current" class="material-symbols fill text-base text-accent">check_circle</span>
      </div>
    </button>
  </div>
</template>

<script>
export default {
  computed: {
    themes() {
      return this.$theme.themes
    },
    current() {
      return this.$theme.state.current
    }
  },
  methods: {
    select(id) {
      this.$theme.setTheme(id)
    }
  }
}
</script>
