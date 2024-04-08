<template>
  <div>
    <div v-if="narrators?.length" class="flex py-0.5 mt-4">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelNarrators }}</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)] overflow-hidden overflow-ellipsis">
        <template v-for="(narrator, index) in narrators">
          <nuxt-link :key="narrator" :to="`/library/${libraryId}/bookshelf?filter=narrators.${$encode(narrator)}`" class="hover:underline">{{ narrator }}</nuxt-link
          ><span :key="index" v-if="index < narrators.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div v-if="publishedYear" class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelPublishYear }}</span>
      </div>
      <div>
        {{ publishedYear }}
      </div>
    </div>
    <div v-if="publisher" class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelPublisher }}</span>
      </div>
      <div>
        <nuxt-link :to="`/library/${libraryId}/bookshelf?filter=publishers.${$encode(publisher)}`" class="hover:underline">{{ publisher }}</nuxt-link>
      </div>
    </div>
    <div v-if="musicAlbum" class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">Album</span>
      </div>
      <div>
        {{ musicAlbum }}
      </div>
    </div>
    <div v-if="musicAlbumArtist" class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">Album Artist</span>
      </div>
      <div>
        {{ musicAlbumArtist }}
      </div>
    </div>
    <div v-if="musicTrackPretty" class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">Track</span>
      </div>
      <div>
        {{ musicTrackPretty }}
      </div>
    </div>
    <div v-if="musicDiscPretty" class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">Disc</span>
      </div>
      <div>
        {{ musicDiscPretty }}
      </div>
    </div>
    <div v-if="podcastType" class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelPodcastType }}</span>
      </div>
      <div class="capitalize">
        {{ podcastType }}
      </div>
    </div>
    <div class="flex py-0.5" v-if="genres.length">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelGenres }}</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)] overflow-hidden overflow-ellipsis">
        <template v-for="(genre, index) in genres">
          <nuxt-link :key="genre" :to="`/library/${libraryId}/bookshelf?filter=genres.${$encode(genre)}`" class="hover:underline">{{ genre }}</nuxt-link
          ><span :key="index" v-if="index < genres.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div class="flex py-0.5" v-if="tags.length">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelTags }}</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)] overflow-hidden overflow-ellipsis">
        <template v-for="(tag, index) in tags">
          <nuxt-link :key="tag" :to="`/library/${libraryId}/bookshelf?filter=tags.${$encode(tag)}`" class="hover:underline">{{ tag }}</nuxt-link
          ><span :key="index" v-if="index < tags.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div v-if="language" class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelLanguage }}</span>
      </div>
      <div>
        <nuxt-link :to="`/library/${libraryId}/bookshelf?filter=languages.${$encode(language)}`" class="hover:underline">{{ language }}</nuxt-link>
      </div>
    </div>
    <div v-if="tracks.length || audioFile || (isPodcast && totalPodcastDuration)" class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelDuration }}</span>
      </div>
      <div>
        {{ durationPretty }}
      </div>
    </div>
    <div class="flex py-0.5">
      <div class="w-24 min-w-24 sm:w-32 sm:min-w-32">
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelSize }}</span>
      </div>
      <div>
        {{ sizePretty }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {}
  },
  computed: {
    libraryId() {
      return this.libraryItem.libraryId
    },
    isPodcast() {
      return this.libraryItem.mediaType === 'podcast'
    },
    audioFile() {
      // Music track
      return this.media.audioFile
    },
    media() {
      return this.libraryItem.media || {}
    },
    tracks() {
      return this.media.tracks || []
    },
    podcastEpisodes() {
      return this.media.episodes || []
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    publishedYear() {
      return this.mediaMetadata.publishedYear
    },
    genres() {
      return this.mediaMetadata.genres || []
    },
    tags() {
      return this.media.tags || []
    },
    podcastAuthor() {
      return this.mediaMetadata.author || ''
    },
    authors() {
      return this.mediaMetadata.authors || []
    },
    publisher() {
      return this.mediaMetadata.publisher || ''
    },
    musicArtists() {
      return this.mediaMetadata.artists || []
    },
    musicAlbum() {
      return this.mediaMetadata.album || ''
    },
    musicAlbumArtist() {
      return this.mediaMetadata.albumArtist || ''
    },
    musicTrackPretty() {
      if (!this.mediaMetadata.trackNumber) return null
      if (!this.mediaMetadata.trackTotal) return this.mediaMetadata.trackNumber
      return `${this.mediaMetadata.trackNumber} / ${this.mediaMetadata.trackTotal}`
    },
    musicDiscPretty() {
      if (!this.mediaMetadata.discNumber) return null
      if (!this.mediaMetadata.discTotal) return this.mediaMetadata.discNumber
      return `${this.mediaMetadata.discNumber} / ${this.mediaMetadata.discTotal}`
    },
    narrators() {
      return this.mediaMetadata.narrators || []
    },
    language() {
      return this.mediaMetadata.language || null
    },
    durationPretty() {
      if (this.isPodcast) return this.$elapsedPrettyExtended(this.totalPodcastDuration)

      if (!this.tracks.length && !this.audioFile) return 'N/A'
      if (this.audioFile) return this.$elapsedPrettyExtended(this.duration)
      return this.$elapsedPretty(this.duration)
    },
    duration() {
      if (!this.tracks.length && !this.audioFile) return 0
      return this.media.duration
    },
    totalPodcastDuration() {
      if (!this.podcastEpisodes.length) return 0
      let totalDuration = 0
      this.podcastEpisodes.forEach((ep) => (totalDuration += ep.duration || 0))
      return totalDuration
    },
    sizePretty() {
      return this.$bytesPretty(this.media.size)
    },
    podcastType() {
      return this.mediaMetadata.type
    }
  },
  methods: {},
  mounted() {}
}
</script>