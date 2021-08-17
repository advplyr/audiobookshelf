<template>
  <div v-if="streamAudiobook" id="streamContainer" class="w-full fixed bottom-0 left-0 right-0 h-40 z-20 bg-primary p-4">
    <div class="absolute -top-16 left-4">
      <cards-book-cover :audiobook="streamAudiobook" :width="88" />
    </div>
    <div class="flex items-center pl-24">
      <div>
        <h1>
          {{ title }} <span v-if="stream" class="text-xs text-gray-400">({{ stream.id }})</span>
        </h1>
        <p class="text-gray-400 text-sm">by {{ author }}</p>
      </div>
      <div class="flex-grow" />
      <span v-if="stream" class="material-icons px-4 cursor-pointer" @click="cancelStream">close</span>
    </div>

    <audio-player ref="audioPlayer" :loading="!stream" @updateTime="updateTime" @hook:mounted="audioPlayerMounted" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      lastServerUpdateSentSeconds: 0,
      stream: null
    }
  },
  computed: {
    cover() {
      if (this.streamAudiobook && this.streamAudiobook.cover) return this.streamAudiobook.cover
      return 'Logo.png'
    },
    user() {
      return this.$store.state.user
    },
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    book() {
      return this.streamAudiobook ? this.streamAudiobook.book || {} : {}
    },
    title() {
      return this.book.title || 'No Title'
    },
    author() {
      return this.book.author || 'Unknown'
    },
    streamId() {
      return this.stream ? this.stream.id : null
    },
    playlistUrl() {
      return this.stream ? this.stream.clientPlaylistUri : null
    }
  },
  methods: {
    audioPlayerMounted() {
      if (this.stream) {
        // this.$refs.audioPlayer.set(this.playlistUrl)
        this.openStream()
      }
    },
    cancelStream() {
      this.$root.socket.emit('close_stream')
    },
    terminateStream() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.terminateStream()
      }
    },
    openStream() {
      var playOnLoad = this.$store.state.playOnLoad
      console.log(`[StreamContainer] openStream PlayOnLoad`, playOnLoad)
      if (!this.$refs.audioPlayer) {
        console.error('NO Audio Player')
        return
      }
      var currentTime = this.stream.clientCurrentTime || 0
      this.$refs.audioPlayer.set(this.playlistUrl, currentTime, playOnLoad)
    },
    streamProgress(data) {
      if (!data.numSegments) return
      var chunks = data.chunks
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setChunksReady(chunks, data.numSegments)
      }
    },
    streamOpen(stream) {
      this.stream = stream
      this.$nextTick(() => {
        this.openStream()
      })
    },
    streamClosed(streamId) {
      if (this.stream && this.stream.id === streamId) {
        this.terminateStream()
        this.$store.commit('clearStreamAudiobook', this.stream.audiobook.id)
      }
    },
    streamReady() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setStreamReady()
      }
    },
    updateTime(currentTime) {
      var diff = currentTime - this.lastServerUpdateSentSeconds
      if (diff > 4 || diff < 0) {
        this.lastServerUpdateSentSeconds = currentTime
        var updatePayload = {
          currentTime,
          streamId: this.streamId
        }
        this.$root.socket.emit('stream_update', updatePayload)
      }
    },
    streamReset({ startTime, streamId }) {
      if (streamId !== this.streamId) {
        console.error('resetStream StreamId Mismatch', streamId, this.streamId)
        return
      }
      if (this.$refs.audioPlayer) {
        console.log(`[STREAM-CONTAINER] streamReset Received for time ${startTime}`)
        this.$refs.audioPlayer.resetStream(startTime)
      }
    }
  },
  mounted() {
    if (this.stream) {
      console.log('[STREAM_CONTAINER] Mounted with STREAM', this.stream)
      this.$nextTick(() => {
        this.openStream()
      })
    }
  }
}
</script>

<style>
#streamContainer {
  box-shadow: 0px -6px 8px #1111113f;
}
</style>