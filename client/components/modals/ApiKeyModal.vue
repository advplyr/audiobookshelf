<template>
  <modals-modal ref="modal" v-model="show" name="api-key" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 overflow-y-auto overflow-x-hidden" style="min-height: 400px; max-height: 80vh">
        <div class="w-full p-8">
          <div class="flex py-2">
            <div class="w-1/2 px-2">
              <ui-text-input-with-label v-model.trim="newApiKey.name" :readonly="!isNew" :label="$strings.LabelName" />
            </div>
            <div v-if="isNew" class="w-1/2 px-2">
              <ui-text-input-with-label v-model.trim="newApiKey.expiresIn" :label="$strings.LabelExpiresInSeconds" type="number" :min="0" />
            </div>
          </div>
          <div class="flex items-center pt-4 pb-2 gap-2">
            <div class="flex items-center px-2">
              <p class="px-3 font-semibold" id="user-enabled-toggle">{{ $strings.LabelEnable }}</p>
              <ui-toggle-switch :disabled="isExpired && !apiKey.isActive" labeledBy="user-enabled-toggle" v-model="newApiKey.isActive" />
            </div>
            <div v-if="isExpired" class="px-2">
              <p class="text-sm text-error">{{ $strings.LabelExpired }}</p>
            </div>
          </div>

          <div class="w-full border-t border-b border-black-200 py-4 px-3 mt-4">
            <p class="text-lg mb-2 font-semibold">{{ $strings.LabelApiKeyUser }}</p>
            <p class="text-sm mb-2 text-gray-400">{{ $strings.LabelApiKeyUserDescription }}</p>
            <ui-select-input v-model="newApiKey.userId" :disabled="isExpired && !apiKey.isActive" :items="userItems" :placeholder="$strings.LabelSelectUser" :label="$strings.LabelApiKeyUser" label-hidden />
          </div>

          <div class="flex pt-4 px-2">
            <div class="grow" />
            <ui-btn color="bg-success" type="submit">{{ $strings.ButtonSubmit }}</ui-btn>
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
    },
    users: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      processing: false,
      newApiKey: {},
      isNew: true
    }
  },
  watch: {
    show: {
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
    title() {
      return this.isNew ? this.$strings.HeaderNewApiKey : this.$strings.HeaderUpdateApiKey
    },
    userItems() {
      return this.users
        .filter((u) => {
          // Only show root user if the current user is root
          return u.type !== 'root' || this.$store.getters['user/getIsRoot']
        })
        .map((u) => ({ text: u.username, value: u.id, subtext: u.type }))
    },
    isExpired() {
      if (!this.apiKey || !this.apiKey.expiresAt) return false

      return new Date(this.apiKey.expiresAt).getTime() < Date.now()
    }
  },
  methods: {
    submitForm() {
      if (!this.newApiKey.name) {
        this.$toast.error(this.$strings.ToastNameRequired)
        return
      }

      if (!this.newApiKey.userId) {
        this.$toast.error(this.$strings.ToastNewApiKeyUserError)
        return
      }

      if (this.isNew) {
        this.submitCreateApiKey()
      } else {
        this.submitUpdateApiKey()
      }
    },
    submitUpdateApiKey() {
      if (this.newApiKey.isActive === this.apiKey.isActive && this.newApiKey.userId === this.apiKey.userId) {
        this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
        this.show = false
        return
      }

      const apiKey = {
        isActive: this.newApiKey.isActive,
        userId: this.newApiKey.userId
      }

      this.processing = true
      this.$axios
        .$patch(`/api/api-keys/${this.apiKey.id}`, apiKey)
        .then((data) => {
          this.processing = false
          if (data.error) {
            this.$toast.error(`${this.$strings.ToastFailedToUpdate}: ${data.error}`)
          } else {
            this.show = false
            this.$emit('updated', data.apiKey)
          }
        })
        .catch((error) => {
          this.processing = false
          console.error('Failed to update apiKey', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(errMsg || this.$strings.ToastFailedToUpdate)
        })
    },
    submitCreateApiKey() {
      const apiKey = { ...this.newApiKey }

      if (this.newApiKey.expiresIn) {
        apiKey.expiresIn = parseInt(this.newApiKey.expiresIn)
      } else {
        delete apiKey.expiresIn
      }

      this.processing = true
      this.$axios
        .$post('/api/api-keys', apiKey)
        .then((data) => {
          this.processing = false
          if (data.error) {
            this.$toast.error(this.$strings.ToastFailedToCreate + ': ' + data.error)
          } else {
            this.show = false
            this.$emit('created', data.apiKey)
          }
        })
        .catch((error) => {
          this.processing = false
          console.error('Failed to create apiKey', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(errMsg || this.$strings.ToastFailedToCreate)
        })
    },
    init() {
      this.isNew = !this.apiKey

      if (this.apiKey) {
        this.newApiKey = {
          name: this.apiKey.name,
          isActive: this.apiKey.isActive,
          userId: this.apiKey.userId
        }
      } else {
        this.newApiKey = {
          name: null,
          expiresIn: null,
          isActive: true,
          userId: null
        }
      }
    }
  },
  mounted() {}
}
</script>
