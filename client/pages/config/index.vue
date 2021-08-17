<template>
  <div class="page p-6" :class="streamAudiobook ? 'streaming' : ''">
    <div class="w-full max-w-4xl mx-auto">
      <h1 class="text-2xl mb-2">Config</h1>
      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />
      <div class="p-4 text-center h-40">
        <p>Nothing much here yet...</p>
      </div>
      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />
      <div class="flex items-center py-4">
        <p class="text-2xl">Scanner</p>
        <div class="flex-grow" />
        <ui-btn color="success" @click="scan">Scan</ui-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {},
  methods: {
    scan() {
      this.$root.socket.emit('scan')
    }
  },
  mounted() {}
}
</script>