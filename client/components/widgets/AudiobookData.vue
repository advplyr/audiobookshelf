<template>
  <div class="w-full">
    <div v-if="missingParts.length" class="bg-error border-red-800 shadow-md p-4">
      <p class="text-sm mb-2">
        Missing Parts <span class="text-sm">({{ missingParts.length }})</span>
      </p>
      <p class="text-sm font-mono">{{ missingPartChunks.join(', ') }}</p>
    </div>

    <div v-if="invalidParts.length" class="bg-error border-red-800 shadow-md p-4">
      <p class="text-sm mb-2">
        Invalid Parts <span class="text-sm">({{ invalidParts.length }})</span>
      </p>
      <div>
        <p v-for="part in invalidParts" :key="part.filename" class="text-sm font-mono">{{ part.filename }}: {{ part.error }}</p>
      </div>
    </div>

    <tables-tracks-table :title="`Audiobook Tracks`" :tracks="media.tracks" :library-item-id="libraryItemId" class="mt-6" />
  </div>
</template>

<script>
export default {
  props: {
    libraryItemId: String,
    media: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {}
  },
  computed: {
    missingPartChunks() {
      if (this.missingParts === 1) return this.missingParts[0]
      var chunks = []

      var currentIndex = this.missingParts[0]
      var currentChunk = [this.missingParts[0]]

      for (let i = 1; i < this.missingParts.length; i++) {
        var partIndex = this.missingParts[i]
        if (currentIndex === partIndex - 1) {
          currentChunk.push(partIndex)
          currentIndex = partIndex
        } else {
          // console.log('Chunk ended', currentChunk.join(', '), currentIndex, partIndex)
          if (currentChunk.length === 0) {
            console.error('How is current chunk 0?', currentChunk.join(', '))
          }
          chunks.push(currentChunk)
          currentChunk = [partIndex]
          currentIndex = partIndex
        }
      }
      if (currentChunk.length) {
        chunks.push(currentChunk)
      }
      chunks = chunks.map((chunk) => {
        if (chunk.length === 1) return chunk[0]
        else return `${chunk[0]}-${chunk[chunk.length - 1]}`
      })
      return chunks
    },
    missingParts() {
      return this.media.missingParts || []
    },
    invalidParts() {
      return this.media.invalidParts || []
    }
  },
  methods: {},
  mounted() {}
}
</script>