<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderApiKeys">
      <template #header-items>
        <div v-if="numApiKeys" class="mx-2 px-1.5 rounded-lg bg-primary/50 text-gray-300/90 text-sm inline-flex items-center justify-center">
          <span>{{ numApiKeys }}</span>
        </div>

        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides/api-keys" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>

        <div class="grow" />

        <ui-btn color="bg-primary" small @click="setShowApiKeyModal()">{{ $strings.ButtonAddApiKey }}</ui-btn>
      </template>

      <tables-api-keys-table ref="apiKeysTable" class="pt-2" @edit="setShowApiKeyModal" @numApiKeys="(count) => (numApiKeys = count)" />
    </app-settings-content>
    <modals-api-key-modal ref="apiKeyModal" v-model="showApiKeyModal" :api-key="selectedApiKey" @created="apiKeyCreated" @deleted="apiKeyDeleted" @updated="apiKeyUpdated" />
    <modals-api-key-created-modal ref="apiKeyCreatedModal" v-model="showApiKeyCreatedModal" :api-key="selectedApiKey" />
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
      selectedApiKey: null,
      showApiKeyModal: false,
      showApiKeyCreatedModal: false,
      numApiKeys: 0
    }
  },
  methods: {
    apiKeyCreated(apiKey) {
      this.numApiKeys++
      this.selectedApiKey = apiKey
      this.showApiKeyCreatedModal = true
      if (this.$refs.apiKeysTable) {
        console.log('apiKeyCreated', apiKey)
        this.$refs.apiKeysTable.addApiKey(apiKey)
      }
    },
    apiKeyDeleted() {
      this.numApiKeys--
    },
    apiKeyUpdated(apiKey) {
      if (this.$refs.apiKeysTable) {
        this.$refs.apiKeysTable.updateApiKey(apiKey)
      }
    },
    setShowApiKeyModal(selectedApiKey) {
      this.selectedApiKey = selectedApiKey
      this.showApiKeyModal = true
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
