<template>
  <div id="authentication-settings">
    <app-settings-content :header-text="$strings.HeaderCustomMetadataProviders">
      <template #header-items>
        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides/#" target="_blank" class="inline-flex">
            <span class="material-icons text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>
        <div class="flex-grow" />

        <ui-btn color="primary" small @click="setShowAddModal">{{ $strings.ButtonAdd }}</ui-btn>
      </template>

      <tables-custom-metadata-provider-table class="pt-2" />
      <modals-add-custom-metadata-provider-modal ref="addModal" v-model="showAddModal" />
    </app-settings-content>
  </div>
</template>

<script>
export default {
  async asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
      return
    }
    return {}
  },
  data() {
    return {
      showAddModal: false,
    }
  },
  methods: {
    setShowAddModal() {
      this.showAddModal = true
    }
  }
}
</script>

<style></style>
