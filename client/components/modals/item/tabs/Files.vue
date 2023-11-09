<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <tables-library-files-table expanded :library-item="libraryItem" :is-missing="isMissing" in-modal />
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
      tracks: []
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
    }
  },
  methods: {
    init() {
      this.tracks = this.media.tracks || []
    }
  }
}
</script>