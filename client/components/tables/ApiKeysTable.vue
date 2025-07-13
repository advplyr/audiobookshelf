<template>
  <div>
    <div class="text-center">
      <table v-if="apiKeys.length > 0" id="api-keys">
        <tr>
          <th>{{ $strings.LabelName }}</th>
          <th class="w-44">{{ $strings.LabelApiKeyUser }}</th>
          <th class="w-32">{{ $strings.LabelExpiresAt }}</th>
          <th class="w-32">{{ $strings.LabelCreatedAt }}</th>
          <th class="w-32"></th>
        </tr>
        <tr v-for="apiKey in apiKeys" :key="apiKey.id" :class="apiKey.isActive ? '' : 'bg-error/10!'">
          <td>
            <div class="flex items-center">
              <p class="pl-2 truncate">{{ apiKey.name }}</p>
            </div>
          </td>
          <td class="text-xs">
            <nuxt-link v-if="apiKey.user" :to="`/config/users/${apiKey.user.id}`" class="text-xs hover:underline">
              {{ apiKey.user.username }}
            </nuxt-link>
            <p v-else class="text-xs">Error</p>
          </td>
          <td class="text-xs">
            <p v-if="apiKey.expiresAt" class="text-xs" :title="apiKey.expiresAt">{{ getExpiresAtText(apiKey) }}</p>
            <p v-else class="text-xs">{{ $strings.LabelExpiresNever }}</p>
          </td>
          <td class="text-xs font-mono">
            <ui-tooltip direction="top" :text="$formatJsDatetime(new Date(apiKey.createdAt), dateFormat, timeFormat)">
              {{ $formatJsDate(new Date(apiKey.createdAt), dateFormat) }}
            </ui-tooltip>
          </td>
          <td class="py-0">
            <div class="w-full flex justify-left">
              <div class="h-8 w-8 flex items-center justify-center text-white/50 hover:text-white/100 cursor-pointer" @click.stop="editApiKey(apiKey)">
                <button type="button" :aria-label="$strings.ButtonEdit" class="material-symbols text-base">edit</button>
              </div>
              <div class="h-8 w-8 flex items-center justify-center text-white/50 hover:text-error cursor-pointer" @click.stop="deleteApiKeyClick(apiKey)">
                <button type="button" :aria-label="$strings.ButtonDelete" class="material-symbols text-base">delete</button>
              </div>
            </div>
          </td>
        </tr>
      </table>
      <p v-else class="text-base text-gray-300 py-4">{{ $strings.LabelNoApiKeys }}</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      apiKeys: [],
      isDeletingApiKey: false
    }
  },
  computed: {
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    timeFormat() {
      return this.$store.state.serverSettings.timeFormat
    }
  },
  methods: {
    getExpiresAtText(apiKey) {
      if (new Date(apiKey.expiresAt).getTime() < Date.now()) {
        return this.$strings.LabelExpired
      }
      return this.$formatJsDatetime(new Date(apiKey.expiresAt), this.dateFormat, this.timeFormat)
    },
    deleteApiKeyClick(apiKey) {
      if (this.isDeletingApiKey) return

      const payload = {
        message: this.$getString('MessageConfirmDeleteApiKey', [apiKey.name]),
        callback: (confirmed) => {
          if (confirmed) {
            this.deleteApiKey(apiKey)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    deleteApiKey(apiKey) {
      this.isDeletingApiKey = true
      this.$axios
        .$delete(`/api/api-keys/${apiKey.id}`)
        .then((data) => {
          if (data.error) {
            this.$toast.error(data.error)
          } else {
            this.removeApiKey(apiKey.id)
            this.$emit('numApiKeys', this.apiKeys.length)
          }
        })
        .catch((error) => {
          console.error('Failed to delete apiKey', error)
          this.$toast.error(this.$strings.ToastFailedToDelete)
        })
        .finally(() => {
          this.isDeletingApiKey = false
        })
    },
    editApiKey(apiKey) {
      this.$emit('edit', apiKey)
    },
    addApiKey(apiKey) {
      this.apiKeys.push(apiKey)
    },
    removeApiKey(apiKeyId) {
      this.apiKeys = this.apiKeys.filter((a) => a.id !== apiKeyId)
    },
    updateApiKey(apiKey) {
      this.apiKeys = this.apiKeys.map((a) => (a.id === apiKey.id ? apiKey : a))
    },
    loadApiKeys() {
      this.$axios
        .$get('/api/api-keys')
        .then((res) => {
          this.apiKeys = res.apiKeys.sort((a, b) => {
            return a.createdAt - b.createdAt
          })
          this.$emit('numApiKeys', this.apiKeys.length)
        })
        .catch((error) => {
          console.error('Failed to load apiKeys', error)
        })
    }
  },
  mounted() {
    this.loadApiKeys()
  }
}
</script>

<style>
#api-keys {
  table-layout: fixed;
  border-collapse: collapse;
  border: 1px solid #474747;
  width: 100%;
}

#api-keys td,
#api-keys th {
  /* border: 1px solid #2e2e2e; */
  padding: 8px 8px;
  text-align: left;
}

#api-keys td.py-0 {
  padding: 0px 8px;
}

#api-keys tr:nth-child(even) {
  background-color: #373838;
}

#api-keys tr:nth-child(odd) {
  background-color: #2f2f2f;
}

#api-keys tr:hover {
  background-color: #444;
}

#api-keys th {
  font-size: 0.8rem;
  font-weight: 600;
  padding-top: 5px;
  padding-bottom: 5px;
  background-color: #272727;
}
</style>
