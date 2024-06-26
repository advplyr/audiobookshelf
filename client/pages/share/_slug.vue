<template>
  <div id="page-wrapper" class="w-full h-screen overflow-y-auto">
    <div class="w-full h-full flex items-center justify-center">
      <div>
        <p class="text-3xl font-semibold text-center mb-6">{{ mediaItemShare.playbackSession?.displayTitle || 'N/A' }}</p>

        <button :aria-label="paused ? $strings.ButtonPlay : $strings.ButtonPause" class="p-4 shadow-sm bg-accent flex items-center justify-center rounded-full text-primary mx-auto" :class="!hasLoaded ? 'animate-spin' : ''" @mousedown.prevent @mouseup.prevent @click.stop="playPause">
          <span class="material-icons text-5xl">{{ !hasLoaded ? 'autorenew' : paused ? 'play_arrow' : 'pause' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import LocalAudioPlayer from '../../players/LocalAudioPlayer'

export default {
  layout: 'blank',
  async asyncData({ params, error, app }) {
    const mediaItemShare = await app.$axios.$get(`/public/share/${params.slug}`).catch((error) => {
      console.error('Failed', error)
      return null
    })
    if (!mediaItemShare) {
      return error({ statusCode: 404, message: 'Not found' })
    }

    return {
      mediaItemShare: mediaItemShare
    }
  },
  data() {
    return {
      localAudioPlayer: new LocalAudioPlayer(),
      playerState: null,
      hasLoaded: false
    }
  },
  computed: {
    audioTracks() {
      return (this.mediaItemShare.playbackSession?.audioTracks || []).map((track) => {
        if (process.env.NODE_ENV === 'development') {
          track.contentUrl = `${process.env.serverUrl}${track.contentUrl}`
        }
        track.relativeContentUrl = track.contentUrl
        return track
      })
    },
    paused() {
      return this.playerState !== 'PLAYING'
    }
  },
  methods: {
    playPause() {
      if (!this.localAudioPlayer || this.mediaLoading) return
      this.localAudioPlayer.playPause()
    },
    playerStateChange(state) {
      console.log('Player state change', state)
      this.playerState = state
      if (state === 'LOADED') {
        this.hasLoaded = true
      }
    }
  },
  mounted() {
    console.log('Loaded media item share', this.mediaItemShare)
    this.localAudioPlayer.set(null, this.audioTracks, false, 0, false)
    this.localAudioPlayer.on('stateChange', this.playerStateChange.bind(this))
  }
}
</script>
