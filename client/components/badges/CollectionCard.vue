<template>
  <nuxt-link :to="to" class="block rounded-2xl bg-bg/60 border border-primary/30 hover:bg-primary/10 transition p-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">{{ title }}</h3>
      <span class="text-xs text-gray-400">{{ count }} badges</span>
    </div>
  </nuxt-link>
</template>

<script>
export default {
  props: {
    title: { type: String, required: true },
    count: { type: Number, required: true },
    to:   { type: String, required: true }
  }
}
</script>
