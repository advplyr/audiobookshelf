<template>
  <div v-show="isScanning" class="fixed bottom-0 left-0 right-0 mx-auto z-20 max-w-lg">
    <div class="w-full my-1 rounded-lg drop-shadow-lg px-4 py-2 flex items-center justify-center text-center transition-all border border-white border-opacity-40 shadow-md bg-warning">
      <p class="text-lg font-sans" v-html="text" />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {
    text() {
      return `Scanning... <span class="font-mono">${this.scanNum}</span> of <span class="font-mono">${this.scanTotal}</span> <strong class='font-mono px-2'>${this.scanPercent}</strong>`
    },
    isScanning() {
      return this.$store.state.isScanning
    },
    scanProgress() {
      return this.$store.state.scanProgress
    },
    scanPercent() {
      return this.scanProgress ? this.scanProgress.progress + '%' : '0%'
    },
    scanNum() {
      return this.scanProgress ? this.scanProgress.done : 0
    },
    scanTotal() {
      return this.scanProgress ? this.scanProgress.total : 0
    }
  },
  methods: {},
  mounted() {}
}
</script>