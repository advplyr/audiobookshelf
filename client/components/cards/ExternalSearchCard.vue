<template>
  <div class="flex items-center h-full px-1 overflow-hidden">
    <div class="overflow-hidden bg-primary rounded-sm flex items-center justify-center shrink-0" style="height: 60px; width: 45px">
      <img v-if="cover" :src="cover" class="w-full h-full object-cover" />
      <span v-else class="material-symbols text-xl text-gray-400">cloud_download</span>
    </div>
    <div class="grow px-2 externalSearchCardContent h-full overflow-hidden">
      <p class="truncate text-sm font-medium">{{ title }}</p>
      <p v-if="author" class="truncate text-xs text-gray-300">{{ $getString('LabelByAuthor', [author]) }}</p>
      <p v-else-if="subtitle" class="truncate text-xs text-gray-400">{{ subtitle }}</p>
      <p v-if="provider" class="text-2xs text-gray-400 uppercase tracking-wider mt-0.5">{{ provider }}</p>
    </div>
    <div class="ml-auto pl-1 pr-1 text-gray-400 shrink-0">
      <span class="material-symbols text-lg hover:text-white" :title="$strings.LabelExternalAudiobookRequest">download</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    item: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    title() {
      return this.item?.title || this.$strings.LabelUnknown
    },
    subtitle() {
      return this.item?.subtitle || ''
    },
    author() {
      return this.item?.author || ''
    },
    cover() {
      return this.item?.cover || null
    },
    provider() {
      return this.item?.provider || ''
    }
  }
}
</script>

<style>
.externalSearchCardContent {
  width: calc(100% - 75px);
  height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
