<template>
  <modals-modal v-model="show" name="rss-feed-modal" :width="600" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" class="px-8 py-6 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div class="w-full">
        <p class="text-lg font-semibold mb-4">Podcast RSS Feed is Open</p>

        <div class="w-full relative">
          <ui-text-input v-model="feedUrl" readonly />

          <span class="material-icons absolute right-2 bottom-2 p-0.5 text-base transition-transform duration-100 text-gray-300 hover:text-white transform hover:scale-125 cursor-pointer" @click="copyToClipboard(feedUrl)">content_copy</span>
        </div>
      </div>
      <div v-show="userIsAdminOrUp" class="flex items-center pt-6">
        <div class="flex-grow" />
        <ui-btn color="error" small @click="closeFeed">Close RSS Feed</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    libraryItem: {
      type: Object,
      default: () => null
    },
    feedUrl: String
  },
  data() {
    return {
      processing: false
    }
  },
  watch: {
    show: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    title() {
      return this.mediaMetadata.title
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    }
  },
  methods: {
    copyToClipboard(str) {
      this.$copyToClipboard(str, this)
    },
    closeFeed() {
      this.processing = true
      this.$axios
        .$post(`/api/podcasts/${this.libraryItem.id}/close-feed`)
        .then(() => {
          this.$toast.success('RSS Feed Closed')
          this.show = false
          this.processing = false
        })
        .catch((error) => {
          console.error('Failed to close RSS feed', error)
          this.processing = false
          this.$toast.error()
        })
    },
    init() {}
  },
  mounted() {}
}
</script>
