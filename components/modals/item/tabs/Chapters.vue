<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <div class="w-full mb-4">
      <tables-chapters-table v-if="chapters.length" :library-item="libraryItem" keep-open @close="closeModal" />
      <div v-if="!chapters.length" class="py-4 text-center">
        <p class="mb-8 text-xl">{{ $strings.MessageNoChapters }}</p>
        <ui-btn v-if="userCanUpdate" :to="`/audiobook/${libraryItem.id}/chapters`" @click="clickAddChapters">{{ $strings.ButtonAddChapters }}</ui-btn>
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
    media() {
      return this.libraryItem?.media || {}
    },
    chapters() {
      return this.media.chapters || []
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    }
  },
  methods: {
    closeModal() {
      this.$emit('close')
    },
    clickAddChapters() {
      if (this.$route.name === 'audiobook-id-chapters' && this.$route.params?.id === this.libraryItem?.id) {
        this.closeModal()
      }
    }
  }
}
</script>
