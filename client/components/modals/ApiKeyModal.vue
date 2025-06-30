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
              <ui-text-input-with-label v-model.trim="newApiKey.expiresIn" :label="$strings.LabelExpiresInSeconds" type="number" />
            </div>
          </div>
          <div class="flex py-2">
            <div class="flex items-center pt-4 px-2">
              <p class="px-3 font-semibold" id="user-enabled-toggle">{{ $strings.LabelEnable }}</p>
              <ui-toggle-switch labeledBy="user-enabled-toggle" v-model="newApiKey.isActive" />
            </div>
          </div>

          <div v-if="newApiKey.permissions" class="w-full border-t border-b border-black-200 py-2 px-3 mt-4">
            <p class="text-lg mb-2 font-semibold">{{ $strings.HeaderPermissions }}</p>
            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="download-permissions-toggle">{{ $strings.LabelPermissionsDownload }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="download-permissions-toggle" v-model="newApiKey.permissions.download" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="update-permissions-toggle">{{ $strings.LabelPermissionsUpdate }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="update-permissions-toggle" v-model="newApiKey.permissions.update" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="delete-permissions-toggle">{{ $strings.LabelPermissionsDelete }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="delete-permissions-toggle" v-model="newApiKey.permissions.delete" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="upload-permissions-toggle">{{ $strings.LabelPermissionsUpload }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="upload-permissions-toggle" v-model="newApiKey.permissions.upload" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="ereader-permissions-toggle">{{ $strings.LabelPermissionsCreateEreader }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="ereader-permissions-toggle" v-model="newApiKey.permissions.createEreader" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="explicit-content-permissions-toggle">{{ $strings.LabelPermissionsAccessExplicitContent }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="explicit-content-permissions-toggle" v-model="newApiKey.permissions.accessExplicitContent" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="access-all-libs--permissions-toggle">{{ $strings.LabelPermissionsAccessAllLibraries }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="access-all-libs--permissions-toggle" v-model="newApiKey.permissions.accessAllLibraries" @input="accessAllLibrariesToggled" />
              </div>
            </div>

            <div v-if="!newApiKey.permissions.accessAllLibraries" class="my-4">
              <ui-multi-select-dropdown v-model="newApiKey.permissions.librariesAccessible" :items="libraryItems" :label="$strings.LabelLibrariesAccessibleToUser" />
            </div>

            <div class="flex items-cen~ter my-2 max-w-md">
              <div class="w-1/2">
                <p>{{ $strings.LabelPermissionsAccessAllTags }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newApiKey.permissions.accessAllTags" @input="accessAllTagsToggled" />
              </div>
            </div>
            <div v-if="!newApiKey.permissions.accessAllTags" class="my-4">
              <div class="flex items-center">
                <ui-multi-select-dropdown v-model="newApiKey.itemTagsSelected" :items="itemTags" :label="tagsSelectionText" />
                <div class="flex items-center pt-4 px-2">
                  <p class="px-3 font-semibold" id="selected-tags-not-accessible--permissions-toggle">{{ $strings.LabelInvert }}</p>
                  <ui-toggle-switch labeledBy="selected-tags-not-accessible--permissions-toggle" v-model="newApiKey.permissions.selectedTagsNotAccessible" />
                </div>
              </div>
            </div>
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
    }
  },
  data() {
    return {
      processing: false,
      newApiKey: {},
      isNew: true,
      tags: [],
      loadingTags: false
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
    libraries() {
      return this.$store.state.libraries.libraries
    },
    libraryItems() {
      return this.libraries.map((lib) => ({ text: lib.name, value: lib.id }))
    },
    itemTags() {
      return this.tags.map((t) => {
        return {
          text: t,
          value: t
        }
      })
    },
    tagsSelectionText() {
      return this.newApiKey.permissions.selectedTagsNotAccessible ? this.$strings.LabelTagsNotAccessibleToUser : this.$strings.LabelTagsAccessibleToUser
    }
  },
  methods: {
    accessAllTagsToggled(val) {
      if (val) {
        if (this.newApiKey.itemTagsSelected?.length) {
          this.newApiKey.itemTagsSelected = []
        }
        this.newApiKey.permissions.selectedTagsNotAccessible = false
      }
    },
    fetchAllTags() {
      this.loadingTags = true
      this.$axios
        .$get(`/api/tags`)
        .then((res) => {
          this.tags = res.tags
          this.loadingTags = false
        })
        .catch((error) => {
          console.error('Failed to load tags', error)
          this.loadingTags = false
        })
    },
    accessAllLibrariesToggled(val) {
      if (!val && !this.newApiKey.permissions.librariesAccessible.length) {
        this.newApiKey.permissions.librariesAccessible = this.libraries.map((l) => l.id)
      } else if (val && this.newApiKey.permissions.librariesAccessible.length) {
        this.newApiKey.permissions.librariesAccessible = []
      }
    },
    submitForm() {
      if (!this.newApiKey.name) {
        this.$toast.error(this.$strings.ToastNewApiKeyNameError)
        return
      }
      if (!this.newApiKey.permissions.accessAllLibraries && !this.newApiKey.permissions.librariesAccessible.length) {
        this.$toast.error(this.$strings.ToastNewApiKeyLibraryError)
        return
      }
      if (!this.newApiKey.permissions.accessAllTags && !this.newApiKey.itemTagsSelected.length) {
        this.$toast.error(this.$strings.ToastNewApiKeyTagError)
        return
      }

      if (this.isNew) {
        this.submitCreateApiKey()
      } else {
        this.submitUpdateApiKey()
      }
    },
    submitUpdateApiKey() {
      var apiKey = {
        isActive: this.newApiKey.isActive,
        permissions: this.newApiKey.permissions
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
      this.fetchAllTags()
      this.isNew = !this.apiKey

      if (this.apiKey) {
        this.newApiKey = {
          name: this.apiKey.name,
          isActive: this.apiKey.isActive,
          permissions: { ...this.apiKey.permissions }
        }
      } else {
        this.newApiKey = {
          name: null,
          expiresIn: null,
          isActive: true,
          permissions: {
            download: true,
            update: false,
            delete: false,
            upload: false,
            accessAllLibraries: true,
            accessAllTags: true,
            accessExplicitContent: false,
            selectedTagsNotAccessible: false,
            createEreader: false,
            librariesAccessible: [],
            itemTagsSelected: []
          }
        }
      }
    }
  },
  mounted() {}
}
</script>
