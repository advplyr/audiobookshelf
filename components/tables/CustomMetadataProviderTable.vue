<template>
  <div class="min-h-40">
    <table v-if="providers.length" id="providers">
      <tr>
        <th>{{ $strings.LabelName }}</th>
        <th>URL</th>
        <th>Authorization Header Value</th>
        <th class="w-12"></th>
      </tr>
      <tr v-for="provider in providers" :key="provider.id">
        <td class="text-sm">{{ provider.name }}</td>
        <td class="text-sm">{{ provider.url }}</td>
        <td class="text-sm">
          <span v-if="provider.authHeaderValue" class="custom-provider-api-key">{{ provider.authHeaderValue }}</span>
        </td>
        <td class="py-0">
          <div class="h-8 w-8 flex items-center justify-center text-white text-opacity-50 hover:text-error cursor-pointer" @click.stop="removeProvider(provider)">
            <button type="button" :aria-label="$strings.ButtonDelete" class="material-symbols text-base">delete</button>
          </div>
        </td>
      </tr>
    </table>
    <div v-else-if="!processing" class="text-center py-8">
      <p class="text-lg">{{ $strings.LabelNoCustomMetadataProviders }}</p>
    </div>

    <div v-if="processing" class="absolute inset-0 h-full flex items-center justify-center bg-black/40 rounded-md">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    providers: {
      type: Array,
      default: () => []
    },
    processing: Boolean
  },
  data() {
    return {}
  },
  methods: {
    removeProvider(provider) {
      const payload = {
        message: this.$getString('MessageConfirmDeleteMetadataProvider', [provider.name]),
        callback: (confirmed) => {
          if (confirmed) {
            this.$emit('update:processing', true)

            this.$axios
              .$delete(`/api/custom-metadata-providers/${provider.id}`)
              .then(() => {
                this.$toast.success(this.$strings.ToastProviderRemoveSuccess)
                this.$emit('removed', provider.id)
              })
              .catch((error) => {
                console.error('Failed to remove provider', error)
                this.$toast.error(this.$strings.ToastRemoveFailed)
              })
              .finally(() => {
                this.$emit('update:processing', false)
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    }
  }
}
</script>

<style>
#providers {
  table-layout: fixed;
  border-collapse: collapse;
  border: 1px solid #474747;
  width: 100%;
}

#providers td,
#providers th {
  /* border: 1px solid #2e2e2e; */
  padding: 8px 8px;
  text-align: left;
}

#providers td.py-0 {
  padding: 0px 8px;
}

#providers tr:nth-child(even) {
  background-color: #373838;
}

#providers tr:nth-child(odd) {
  background-color: #2f2f2f;
}

#providers tr:hover {
  background-color: #444;
}

#providers th {
  font-size: 0.8rem;
  font-weight: 600;
  padding-top: 5px;
  padding-bottom: 5px;
  background-color: #272727;
}

.custom-provider-api-key {
  padding: 1px;
  background-color: #272727;
  border-radius: 4px;
  color: transparent;
  transition: color, background-color 0.5s ease;
}

.custom-provider-api-key:hover {
  background-color: transparent;
  color: white;
}
</style>
