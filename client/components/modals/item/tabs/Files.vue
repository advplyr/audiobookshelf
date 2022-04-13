<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <template v-for="audiobook in audiobooks">
      <tables-tracks-table :key="audiobook.id" :title="`Audiobook Tracks (${audiobook.name})`" :audiobook-id="audiobook.id" :tracks="audiobook.tracks" class="mb-4" />
    </template>

    <tables-library-files-table expanded :files="libraryFiles" :library-item-id="libraryItem.id" :is-missing="isMissing" />
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
    return {
      tracks: [],
      showFullPath: false
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    media() {
      return this.libraryItem.media || {}
    },
    libraryFiles() {
      return this.libraryItem.libraryFiles || []
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    isMissing() {
      return this.libraryItem.isMissing
    },
    showDownload() {
      return this.userCanDownload && !this.isMissing
    },
    audiobooks() {
      return this.media.audiobooks || []
    },
    ebooks() {
      return this.media.ebooks || []
    }
  },
  methods: {
    init() {
      this.tracks = this.media.tracks || []
    }
  }
}
</script>