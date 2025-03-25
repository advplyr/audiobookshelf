<template>
  <div class="flex items-center px-4 py-2 justify-start relative hover:bg-black-400" @mouseover="mouseover" @mouseleave="mouseleave">
    <div v-if="isItemIncluded" class="absolute top-0 left-0 h-full w-1 bg-success z-10" />
    <div class="w-16 max-w-16 text-center">
      <covers-playlist-cover :items="items" :width="64" :height="64" />
    </div>
    <div class="grow overflow-hidden px-2">
      <nuxt-link :to="`/playlist/${playlist.id}`" class="pl-2 pr-2 truncate hover:underline cursor-pointer" @click.native="clickNuxtLink">{{ playlist.name }}</nuxt-link>
    </div>
    <div class="h-full flex items-center justify-end transform" :class="isHovering ? 'transition-transform translate-0 w-16' : 'translate-x-40 w-0'">
      <ui-btn v-if="!isItemIncluded" color="bg-success" :padding-x="3" small class="h-9" @click.stop="clickAdd"><span class="material-symbols text-2xl pt-px">add</span></ui-btn>
      <ui-btn v-else color="bg-error" :padding-x="3" class="h-9" small @click.stop="clickRem"><span class="material-symbols text-2xl pt-px">remove</span></ui-btn>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    playlist: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      isHovering: false
    }
  },
  computed: {
    isItemIncluded() {
      return !!this.playlist.isItemIncluded
    },
    items() {
      return this.playlist.items || []
    }
  },
  methods: {
    clickNuxtLink() {
      this.$emit('close')
    },
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    clickAdd() {
      this.$emit('add', this.playlist)
    },
    clickRem() {
      this.$emit('remove', this.playlist)
    }
  },
  mounted() {}
}
</script>
