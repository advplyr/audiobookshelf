<template>
  <div class="flex h-full px-1 overflow-hidden">
    <div class="w-10 h-10 flex items-center justify-center">
      <span class="material-symbols text-2xl text-gray-200">local_offer</span>
    </div>
    <div class="grow px-2 tagSearchCardContent h-full">
      <p class="truncate text-sm">{{ tag }}</p>
      <p class="text-xs text-gray-400">{{ $getString('LabelXItems', [numItems]) }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    tag: String,
    numItems: Number
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
  height: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
