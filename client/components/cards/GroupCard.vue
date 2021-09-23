<template>
  <div class="relative">
    <div class="rounded-sm h-full overflow-hidden relative" :style="{ padding: `16px ${paddingX}px` }" @mouseover="isHovering = true" @mouseleave="isHovering = false" @click="clickCard">
      <nuxt-link :to="`/library`" class="cursor-pointer">
        <div class="w-full relative box-shadow-book bg-primary" :style="{ height: height + 'px', width: height + 'px' }"></div>
      </nuxt-link>
    </div>
    <!-- <div :style="{ width: height + 'px', height: height + 'px' }" class="box-shadow-book bg-primary">
    <p class="text-white">{{ groupName }}</p>
  </div> -->
  </div>
</template>

<script>
export default {
  props: {
    group: {
      type: Object,
      default: () => null
    },
    width: {
      type: Number,
      default: 120
    }
  },
  data() {
    return {
      isHovering: false
    }
  },
  computed: {
    _group() {
      return this.group || {}
    },
    height() {
      return this.width * 1.6
    },
    sizeMultiplier() {
      return this.width / 120
    },
    paddingX() {
      return 16 * this.sizeMultiplier
    },
    books() {
      return this._group.books || []
    },
    groupName() {
      return this._group.name || 'No Name'
    }
  },
  methods: {
    clickCard() {}
  },
  mounted() {}
}
</script>