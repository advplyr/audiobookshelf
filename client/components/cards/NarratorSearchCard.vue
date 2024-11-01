<template>
  <div class="flex h-full px-1 overflow-hidden">
    <div class="w-10 h-10 flex items-center justify-center">
      <span class="material-symbols text-2xl text-gray-200">&#xe91f;</span>
    </div>
    <div class="flex-grow px-2 narratorSearchCardContent h-full">
      <p class="truncate text-sm">{{ narrator }}</p>
      <p class="text-xs text-gray-400">{{ $getString('LabelXBooks', [numBooks]) }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    narrator: String,
    numBooks: Number
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script>

<style scoped>
.narratorSearchCardContent {
  width: calc(100% - 40px);
  height: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
