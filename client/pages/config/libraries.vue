<template>
  <div>
    <tables-library-libraries-table @showLibraryModal="setShowLibraryModal" />

    <modals-libraries-edit-modal v-model="showLibraryModal" :library="selectedLibrary" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      showLibraryModal: false,
      selectedLibrary: null
    }
  },
  computed: {},
  methods: {
    setShowLibraryModal(selectedLibrary) {
      this.selectedLibrary = selectedLibrary
      this.showLibraryModal = true
    }
  },
  mounted() {}
}
</script>