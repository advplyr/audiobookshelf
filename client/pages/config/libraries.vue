<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderLibraries" show-add-button @clicked="setShowLibraryModal">
      <tables-library-libraries-table @showLibraryModal="setShowLibraryModal" />
    </app-settings-content>
    <modals-libraries-edit-modal v-model="showLibraryModal" :library="selectedLibrary" />
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
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