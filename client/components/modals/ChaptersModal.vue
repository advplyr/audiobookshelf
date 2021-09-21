<template>
  <modals-modal v-model="show" :width="500" :height="'unset'">
    <div class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 500px">
      <template v-for="chap in chapters">
        <div :key="chap.id" class="flex items-center px-6 py-3 justify-start cursor-pointer hover:bg-bg relative" :class="chap.id === currentChapterId ? 'bg-bg bg-opacity-80' : 'bg-opacity-20'" @click="clickChapter(chap)">
          {{ chap.title }}
          <span class="flex-grow" />
          <span class="font-mono text-sm text-gray-300">{{ $secondsToTimestamp(chap.start) }}</span>
        </div>
      </template>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    chapters: {
      type: Array,
      default: () => []
    },
    currentChapter: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {}
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    currentChapterId() {
      return this.currentChapter ? this.currentChapter.id : null
    }
  },
  methods: {
    clickChapter(chap) {
      this.$emit('select', chap)
    }
  },
  mounted() {}
}
</script>