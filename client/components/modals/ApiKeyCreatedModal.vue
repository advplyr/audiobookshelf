<template>
  <modals-modal ref="modal" v-model="show" name="api-key-created" :width="800" :height="'unset'" persistent>
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 overflow-y-auto overflow-x-hidden" style="min-height: 200px; max-height: 80vh">
        <div class="w-full p-8">
          <p class="text-lg text-white mb-4">{{ $getString('LabelApiKeyCreated', [apiKeyName]) }}</p>

          <p class="text-lg text-white mb-4">{{ $strings.LabelApiKeyCreatedDescription }}</p>

          <ui-text-input label="API Key" :value="apiKeyKey" readonly show-copy />

          <div class="flex justify-end mt-4">
            <ui-btn color="bg-primary" @click="show = false">{{ $strings.ButtonClose }}</ui-btn>
          </div>
        </div>
      </div>
    </form>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    apiKey: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {}
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
    title() {
      return this.$strings.HeaderNewApiKey
    },
    apiKeyName() {
      return this.apiKey?.name || ''
    },
    apiKeyKey() {
      return this.apiKey?.apiKey || ''
    }
  },
  methods: {},
  mounted() {}
}
</script>
