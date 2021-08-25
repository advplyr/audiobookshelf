<template>
  <div v-show="isScanning" class="fixed bottom-4 left-0 right-0 mx-auto z-20 max-w-lg">
    <div class="w-full my-1 rounded-lg drop-shadow-lg px-4 py-2 flex items-center justify-center text-center transition-all border border-white border-opacity-40 shadow-md bg-warning">
      <p class="text-lg font-sans" v-html="text" />
    </div>
    <div v-show="!hasCanceled" class="absolute right-0 top-3 bottom-0 px-2">
      <ui-btn color="red-600" small :padding-x="1" @click="cancelScan">Cancel</ui-btn>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      hasCanceled: false
    }
  },
  watch: {
    isScanning(newVal) {
      if (newVal) {
        this.hasCanceled = false
      }
    }
  },
  computed: {
    text() {
      var scanText = this.isScanningFiles ? 'Scanning...' : 'Scanning Covers...'
      return `${scanText} <span class="font-mono">${this.scanNum}</span> of <span class="font-mono">${this.scanTotal}</span> <strong class='font-mono px-2'>${this.scanPercent}</strong>`
    },
    isScanning() {
      return this.isScanningFiles || this.isScanningCovers
    },
    isScanningFiles() {
      return this.$store.state.isScanning
    },
    isScanningCovers() {
      return this.$store.state.isScanningCovers
    },
    scanProgressKey() {
      return this.isScanningFiles ? 'scanProgress' : 'coverScanProgress'
    },
    scanProgress() {
      return this.$store.state[this.scanProgressKey]
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
  methods: {
    cancelScan() {
      this.hasCanceled = true
      this.$root.socket.emit('cancel_scan')
    }
  },
  mounted() {}
}
</script>