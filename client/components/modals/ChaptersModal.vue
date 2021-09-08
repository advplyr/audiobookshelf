<template>
  <modals-modal v-model="show" :width="500" :height="'unset'">
    <div class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 500px">
      <template v-for="chap in chapters">
        <div :key="chap.id" class="flex items-center px-6 py-3 justify-start cursor-pointer hover:bg-bg bg-opacity-20 rounded-lg relative" @click="clickChapter(chap)">
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