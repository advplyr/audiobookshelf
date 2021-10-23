<template>
  <div class="w-3 h-3">
    <div v-if="value" class="w-full h-full text-sm mr-2 text-success animate-pulse">
      <svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
      </svg>
    </div>
    <svg v-else class="w-full h-full mr-2 text-white text-opacity-20" viewBox="0 0 24 24">
      <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
    </svg>
  </div>
</template>

<script>
export default {
  props: {
    value: Boolean
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script>