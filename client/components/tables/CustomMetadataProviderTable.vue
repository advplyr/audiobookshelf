<template>
  <div>
    <div class="text-center">
      <table id="providers">
        <tr>
          <th>{{ $strings.LabelName }}</th>
          <th>{{ $strings.LabelUrl }}</th>
          <th>{{ $strings.LabelApiKey }}</th>
          <th class="w-12"></th>
        </tr>
        <tr v-for="provider in providers" :key="provider.id">
          <td class="text-sm">{{ provider.name }}</td>
          <td class="text-sm">{{ provider.url }}</td>
          <td class="text-sm">
            <span class="custom-provider-api-key">{{ provider.apiKey }}</span>
          </td>
          <td class="py-0">
            <div class="h-8 w-8 flex items-center justify-center text-white text-opacity-50 hover:text-error cursor-pointer" @click.stop="removeProvider(provider)">
              <button type="button" :aria-label="$strings.ButtonDelete" class="material-icons text-base">delete</button>
            </div>
          </td>
        </tr>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      providers: [],
    }
  },
  methods: {
    addedProvider(provider) {
      if (!Array.isArray(this.providers)) return

      this.providers.push(provider)
    },
    removedProvider(provider) {
      this.providers = this.providers.filter((p) => p.id !== provider.id)
    },
    removeProvider(provider) {
      this.$axios
          .$delete(`/api/custom-metadata-providers/admin/${provider.id}`)
          .then((data) => {
            if (data.error) {
              this.$toast.error(`Failed to remove provider: ${data.error}`)
            } else {
              this.$toast.success('Provider removed')
            }
          })
          .catch((error) => {
            console.error('Failed to remove provider', error)
            this.$toast.error('Failed to remove provider')
          })
    },
    loadProviders() {
      this.$axios.$get('/api/custom-metadata-providers/admin')
          .then((res) => {
            this.providers = res.providers
          })
          .catch((error) => {
            console.error('Failed', error)
          })
    },
    init(attempts = 0) {
      if (!this.$root.socket) {
        if (attempts > 10) {
          return console.error('Failed to setup socket listeners')
        }
        setTimeout(() => {
          this.init(++attempts)
        }, 250)
        return
      }
      this.$root.socket.on('custom_metadata_provider_added', this.addedProvider)
      this.$root.socket.on('custom_metadata_provider_removed', this.removedProvider)
    }
  },
  mounted() {
    this.loadProviders()
    this.init()
  },
  beforeDestroy() {
    if (this.$refs.addModal) {
      this.$refs.addModal.close()
    }

    if (this.$root.socket) {
      this.$root.socket.off('custom_metadata_provider_added', this.addedProvider)
      this.$root.socket.off('custom_metadata_provider_removed', this.removedProvider)
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
