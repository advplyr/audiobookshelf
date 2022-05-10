<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <div class="w-full mb-4">
      <tables-chapters-table v-if="chapters.length" :library-item="libraryItem" keep-open />
      <div v-if="!chapters.length" class="py-4 text-center">
        <p class="mb-8 text-xl">No Chapters</p>
        <ui-btn v-if="userCanUpdate" :to="`/audiobook/${libraryItem.id}/chapters`">Add Chapters</ui-btn>
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
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    chapters() {
      return this.media.chapters || []
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    }
  },
  methods: {}
}
</script>