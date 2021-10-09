<template>
  <div class="flex h-full px-1 overflow-hidden">
    <cards-group-cover :name="series" :book-items="bookItems" :width="60" :height="60" />
    <div class="flex-grow px-2 seriesSearchCardContent h-full">
      <p class="truncate text-sm">{{ series }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    series: String,
    bookItems: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script>

<style>
.seriesSearchCardContent {
  width: calc(100% - 80px);
  height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>