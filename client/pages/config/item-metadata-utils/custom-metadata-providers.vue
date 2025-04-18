<template>
  <div class="relative">
    <app-settings-content :header-text="$strings.HeaderCustomMetadataProviders">
      <template #header-prefix>
        <nuxt-link to="/config/item-metadata-utils" class="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer hover:bg-white/10 text-center mr-2">
          <span class="material-symbols text-2xl">arrow_back</span>
        </nuxt-link>
      </template>
      <template #header-items>
        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides/custom-metadata-providers" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>
        <div class="grow" />

        <ui-btn color="bg-primary" small @click="setShowAddModal">{{ $strings.ButtonAdd }}</ui-btn>
      </template>

      <tables-custom-metadata-provider-table :providers="providers" :processing.sync="processing" class="pt-2" @removed="providerRemoved" />
      <modals-add-custom-metadata-provider-modal ref="addModal" v-model="showAddModal" @added="providerAdded" />
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
      processing: false,
      providers: []
    }
  },
  methods: {
    providerRemoved(providerId) {
      this.providers = this.providers.filter((p) => p.id !== providerId)
    },
    providerAdded(provider) {
      this.providers.push(provider)
    },
    setShowAddModal() {
      this.showAddModal = true
    },
    loadProviders() {
      this.processing = true
      this.$axios
        .$get('/api/custom-metadata-providers')
        .then((res) => {
          this.providers = res.providers
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
        })
        .finally(() => {
          this.processing = false
        })
    }
  },
  mounted() {
    this.loadProviders()
  }
}
</script>

<style></style>
