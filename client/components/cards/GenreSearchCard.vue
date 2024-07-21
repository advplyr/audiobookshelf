<template>
  <div class="flex h-full px-1 overflow-hidden">
    <div class="w-10 h-10 flex items-center justify-center">
      <span class="material-symbols text-2xl text-gray-200">category</span>
    </div>
    <div class="flex-grow px-2 tagSearchCardContent h-full">
      <p class="truncate text-sm">{{ genre }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    genre: String
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
.tagSearchCardContent {
  width: calc(100% - 40px);
  height: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
