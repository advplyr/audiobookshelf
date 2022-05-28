<template>
  <modals-modal ref="modal" v-model="show" name="account" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300">
        <div class="w-full p-8">
          <div class="flex py-2">
            <div class="w-1/2 px-2">
              <ui-text-input-with-label v-model="newUser.username" label="Username" />
            </div>
            <div class="w-1/2 px-2">
              <ui-text-input-with-label v-if="!isEditingRoot" v-model="newUser.password" :label="isNew ? 'Password' : 'Change Password'" type="password" />
            </div>
          </div>
          <div v-show="!isEditingRoot" class="flex py-2">
            <div class="px-2 w-52">
              <ui-dropdown v-model="newUser.type" label="Account Type" :disabled="isEditingRoot" :items="accountTypes" @input="userTypeUpdated" />
            </div>
            <div class="flex-grow" />
            <div class="flex items-center pt-4 px-2">
              <p class="px-3 font-semibold" :class="isEditingRoot ? 'text-gray-300' : ''">Is Active</p>
              <ui-toggle-switch v-model="newUser.isActive" :disabled="isEditingRoot" />
            </div>
          </div>

          <div v-if="!isEditingRoot && newUser.permissions" class="w-full border-t border-b border-black-200 py-2 px-3 mt-4">
            <p class="text-lg mb-2 font-semibold">Permissions</p>
            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Download</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.download" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Update</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.update" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Delete</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.delete" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Upload</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.upload" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Access Explicit Content</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.accessExplicitContent" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Access All Libraries</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.accessAllLibraries" @input="accessAllLibrariesToggled" />
              </div>
            </div>

            <div v-if="!newUser.permissions.accessAllLibraries" class="my-4">
              <ui-multi-select-dropdown v-model="newUser.librariesAccessible" :items="libraryItems" label="Libraries Accessible to User" />
            </div>

            <div class="flex items-cen~ter my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Access All Tags</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.accessAllTags" @input="accessAllTagsToggled" />
              </div>
            </div>
            <div v-if="!newUser.permissions.accessAllTags" class="my-4">
              <ui-multi-select-dropdown v-model="newUser.itemTagsAccessible" :items="itemTags" label="Tags Accessible to User" />
            </div>
          </div>

          <div class="flex pt-4 px-2">
            <ui-btn v-if="isEditingRoot" to="/account">Change Root Password</ui-btn>
            <div class="flex-grow" />
            <ui-btn color="success" type="submit">Submit</ui-btn>
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
    account: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      processing: false,
      newUser: {},
      isNew: true,
      accountTypes: [
        {
          text: 'Guest',
          value: 'guest'
        },
        {
          text: 'User',
          value: 'user'
        },
        {
          text: 'Admin',
          value: 'admin'
        }
      ],
      tags: [],
      loadingTags: false
    }
  },
  watch: {
    show: {
      handler(newVal) {
        console.log('accoutn modal show change', newVal)
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
      return this.isNew ? 'Add New Account' : `Update ${(this.account || {}).username}`
    },
    isEditingRoot() {
      return this.account && this.account.type === 'root'
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
    }
  },
  methods: {
    close() {
      // Force close when navigating - used in UsersTable
      if (this.$refs.modal) this.$refs.modal.setHide()
    },
    accessAllTagsToggled(val) {
      if (val && this.newUser.itemTagsAccessible.length) {
        this.newUser.itemTagsAccessible = []
      }
    },
    fetchAllTags() {
      this.loadingTags = true
      this.$axios
        .$get(`/api/tags`)
        .then((tags) => {
          this.tags = tags
          this.loadingTags = false
        })
        .catch((error) => {
          console.error('Failed to load tags', error)
          this.loadingTags = false
        })
    },
    accessAllLibrariesToggled(val) {
      if (!val && !this.newUser.librariesAccessible.length) {
        this.newUser.librariesAccessible = this.libraries.map((l) => l.id)
      } else if (val && this.newUser.librariesAccessible.length) {
        this.newUser.librariesAccessible = []
      }
    },
    submitForm() {
      if (!this.newUser.username) {
        this.$toast.error('Enter a username')
        return
      }
      if (!this.newUser.permissions.accessAllLibraries && !this.newUser.librariesAccessible.length) {
        this.$toast.error('Must select at least one library')
        return
      }
      if (!this.newUser.permissions.accessAllTags && !this.newUser.itemTagsAccessible.length) {
        this.$toast.error('Must select at least one tag')
        return
      }

      if (this.isNew) {
        this.submitCreateAccount()
      } else {
        this.submitUpdateAccount()
      }
    },
    submitUpdateAccount() {
      var account = { ...this.newUser }
      if (!account.password || account.type === 'root') {
        delete account.password
      }
      if (account.type === 'root' && !account.isActive) return

      this.processing = true
      console.log('Calling update', account)
      this.$axios
        .$patch(`/api/users/${this.account.id}`, account)
        .then((data) => {
          this.processing = false
          if (data.error) {
            this.$toast.error(`Failed to update account: ${data.error}`)
          } else {
            console.log('Account updated', data.user)
            this.$toast.success('Account updated')
            this.show = false
          }
        })
        .catch((error) => {
          this.processing = false
          console.error('Failed to update account', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(errMsg || 'Failed to update account')
        })
    },
    submitCreateAccount() {
      if (!this.newUser.password) {
        this.$toast.error('Must have a password, only root user can have an empty password')
        return
      }

      var account = { ...this.newUser }
      this.processing = true
      this.$axios
        .$post('/api/users', account)
        .then((data) => {
          this.processing = false
          if (data.error) {
            this.$toast.error(`Failed to create account: ${data.error}`)
          } else {
            this.$toast.success('New account created')
            this.show = false
          }
        })
        .catch((error) => {
          this.processing = false
          console.error('Failed to create account', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(errMsg || 'Failed to create account')
        })
    },
    toggleActive() {
      this.newUser.isActive = !this.newUser.isActive
    },
    userTypeUpdated(type) {
      this.newUser.permissions = {
        download: type !== 'guest',
        update: type === 'admin',
        delete: type === 'admin',
        upload: type === 'admin',
        accessAllLibraries: true,
        accessAllTags: true
      }
    },
    init() {
      this.fetchAllTags()

      this.isNew = !this.account
      if (this.account) {
        console.log(this.account)
        this.newUser = {
          username: this.account.username,
          password: this.account.password,
          type: this.account.type,
          isActive: this.account.isActive,
          permissions: { ...this.account.permissions },
          librariesAccessible: [...(this.account.librariesAccessible || [])],
          itemTagsAccessible: [...(this.account.itemTagsAccessible || [])]
        }
      } else {
        this.newUser = {
          username: null,
          password: null,
          type: 'user',
          isActive: true,
          permissions: {
            download: true,
            update: false,
            delete: false,
            upload: false,
            accessAllLibraries: true,
            accessAllTags: true
          },
          librariesAccessible: []
        }
      }
    }
  },
  mounted() {}
}
</script>
