<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-4">{{ $strings.HeaderChapters }}</p>
      <span class="bg-black-400 rounded-xl py-1 px-2 text-sm font-mono">{{ chapters.length }}</span>
      <div class="grow" />
      <ui-btn v-if="userCanUpdate" small :to="`/audiobook/${libraryItemId}/chapters`" color="bg-primary" class="mr-2" @click="clickEditChapters">{{ $strings.ButtonEditChapters }}</ui-btn>
      <div v-if="!keepOpen" class="cursor-pointer h-10 w-10 rounded-full hover:bg-black-400 flex justify-center items-center duration-500" :class="expanded ? 'transform rotate-180' : ''">
        <span class="material-symbols text-4xl">&#xe313;</span>
      </div>
    </div>
    <transition name="slide">
      <table class="text-sm tracksTable" v-show="expanded || keepOpen">
        <tr>
          <th class="text-left w-16"><span class="px-4">Id</span></th>
          <th class="text-left">{{ $strings.LabelTitle }}</th>
          <th class="text-center">{{ $strings.LabelStart }}</th>
          <th class="text-center">{{ $strings.LabelDuration }}</th>
        </tr>
        <tr v-for="chapter in chapters" :key="chapter.id">
          <td class="text-left">
            <p class="px-4">{{ chapter.id }}</p>
          </td>
          <td dir="auto">
            {{ chapter.title }}
          </td>
          <td class="font-mono text-center hover:underline cursor-pointer" @click.stop="goToTimestamp(chapter.start)">
            {{ $secondsToTimestamp(chapter.start) }}
          </td>
          <td class="font-mono text-center">
            {{ $secondsToTimestamp(Math.max(0, chapter.end - chapter.start)) }}
          </td>
        </tr>
      </table>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    },
    keepOpen: Boolean
  },
  data() {
    return {
      expanded: false
    }
  },
  computed: {
    libraryItemId() {
      return this.libraryItem.id
    },
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    metadata() {
      return this.media.metadata || {}
    },
    chapters() {
      return this.media.chapters || []
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    }
  },
  methods: {
    clickBar() {
      this.expanded = !this.expanded
    },
    goToTimestamp(time) {
      const queueItem = {
        libraryItemId: this.libraryItemId,
        libraryId: this.libraryItem.libraryId,
        episodeId: null,
        title: this.metadata.title,
        subtitle: this.metadata.authors.map((au) => au.name).join(', '),
        caption: '',
        duration: this.media.duration || null,
        coverPath: this.media.coverPath || null
      }

      if (this.$store.getters['getIsMediaStreaming'](this.libraryItemId)) {
        this.$eventBus.$emit('play-item', {
          libraryItemId: this.libraryItemId,
          episodeId: null,
          startTime: time,
          queueItems: [queueItem]
        })
      } else {
        const payload = {
          message: `Start playback for "${this.metadata.title}" at ${this.$secondsToTimestamp(time)}?`,
          callback: (confirmed) => {
            if (confirmed) {
              this.$eventBus.$emit('play-item', {
                libraryItemId: this.libraryItemId,
                episodeId: null,
                startTime: time,
                queueItems: [queueItem]
              })
            }
          },
          type: 'yesNo'
        }
        this.$store.commit('globals/setConfirmPrompt', payload)
      }
    },
    clickEditChapters() {
      // Used for Chapters tab in modal
      if (this.$route.name === 'audiobook-id-chapters' && this.$route.params?.id === this.libraryItem?.id) {
        this.$emit('close')
      }
    }
  },
  mounted() {}
}
</script>
