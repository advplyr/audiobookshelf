<template>
  <modals-modal ref="modal" v-model="show" name="account" :width="800" :height="'unset'" :processing="processing">
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
              <ui-text-input-with-label v-model.trim="newUser.username" :label="$strings.LabelUsername" />
            </div>
            <div class="w-1/2 px-2">
              <ui-text-input-with-label v-if="!isEditingRoot" v-model="newUser.password" :label="isNew ? $strings.LabelPassword : $strings.LabelChangePassword" type="password" />
              <ui-text-input-with-label v-else v-model.trim="newUser.email" :label="$strings.LabelEmail" />
            </div>
          </div>
          <div v-show="!isEditingRoot" class="flex py-2">
            <div class="w-1/2 px-2">
              <ui-text-input-with-label v-model.trim="newUser.email" :label="$strings.LabelEmail" />
            </div>
            <div class="px-2 w-52">
              <ui-dropdown v-model="newUser.type" :label="$strings.LabelAccountType" :disabled="isEditingRoot" :items="accountTypes" small @input="userTypeUpdated" />
            </div>

            <div class="flex items-center pt-4 px-2">
              <p class="px-3 font-semibold" id="user-enabled-toggle" :class="isEditingRoot ? 'text-gray-300' : ''">{{ $strings.LabelEnable }}</p>
              <ui-toggle-switch labeledBy="user-enabled-toggle" v-model="newUser.isActive" :disabled="isEditingRoot" />
            </div>
          </div>

          <div v-if="!isEditingRoot && newUser.permissions" class="w-full border-t border-b border-black-200 py-2 px-3 mt-4">
            <p class="text-lg mb-2 font-semibold">{{ $strings.HeaderPermissions }}</p>
            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="download-permissions-toggle">{{ $strings.LabelPermissionsDownload }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="download-permissions-toggle" v-model="newUser.permissions.download" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="update-permissions-toggle">{{ $strings.LabelPermissionsUpdate }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="update-permissions-toggle" v-model="newUser.permissions.update" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="delete-permissions-toggle">{{ $strings.LabelPermissionsDelete }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="delete-permissions-toggle" v-model="newUser.permissions.delete" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="upload-permissions-toggle">{{ $strings.LabelPermissionsUpload }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="upload-permissions-toggle" v-model="newUser.permissions.upload" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="ereader-permissions-toggle">{{ $strings.LabelPermissionsCreateEreader }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="ereader-permissions-toggle" v-model="newUser.permissions.createEreader" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="explicit-content-permissions-toggle">{{ $strings.LabelPermissionsAccessExplicitContent }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="explicit-content-permissions-toggle" v-model="newUser.permissions.accessExplicitContent" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p id="access-all-libs--permissions-toggle">{{ $strings.LabelPermissionsAccessAllLibraries }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch labeledBy="access-all-libs--permissions-toggle" v-model="newUser.permissions.accessAllLibraries" @input="accessAllLibrariesToggled" />
              </div>
            </div>

            <div v-if="!newUser.permissions.accessAllLibraries" class="my-4">
              <ui-multi-select-dropdown v-model="newUser.librariesAccessible" :items="libraryItems" :label="$strings.LabelLibrariesAccessibleToUser" />
            </div>

            <div class="flex items-cen~ter my-2 max-w-md">
              <div class="w-1/2">
                <p>{{ $strings.LabelPermissionsAccessAllTags }}</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.accessAllTags" @input="accessAllTagsToggled" />
              </div>
            </div>
            <div v-if="!newUser.permissions.accessAllTags" class="my-4">
              <div class="flex items-center">
                <ui-multi-select-dropdown v-model="newUser.itemTagsSelected" :items="itemTags" :label="tagsSelectionText" />
                <div class="flex items-center pt-4 px-2">
                  <p class="px-3 font-semibold" id="selected-tags-not-accessible--permissions-toggle">{{ $strings.LabelInvert }}</p>
                  <ui-toggle-switch labeledBy="selected-tags-not-accessible--permissions-toggle" v-model="newUser.permissions.selectedTagsNotAccessible" />
                </div>
              </div>
            </div>
          </div>

          <div class="flex pt-4 px-2">
            <ui-btn v-if="hasOpenIDLink" small :loading="unlinkingFromOpenID" color="bg-primary" type="button" class="mr-2" @click.stop="unlinkOpenID">{{ $strings.ButtonUnlinkOpenId }}</ui-btn>
            <ui-btn v-if="isEditingRoot" small class="flex items-center" to="/account">{{ $strings.ButtonChangeRootPassword }}</ui-btn>
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
      tags: [],
      loadingTags: false,
      unlinkingFromOpenID: false
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
    accountTypes() {
      return [
        {
          text: this.$strings.LabelAccountTypeGuest,
          value: 'guest'
        },
        {
          text: this.$strings.LabelAccountTypeUser,
          value: 'user'
        },
        {
          text: this.$strings.LabelAccountTypeAdmin,
          value: 'admin'
        }
      ]
    },
    user() {
      return this.$store.state.user.user
    },
    title() {
      return this.isNew ? this.$strings.HeaderNewAccount : this.$strings.HeaderUpdateAccount
    },
    isEditingRoot() {
      return this.account?.type === 'root'
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
      return this.newUser.permissions.selectedTagsNotAccessible ? this.$strings.LabelTagsNotAccessibleToUser : this.$strings.LabelTagsAccessibleToUser
    },
    hasOpenIDLink() {
      return !!this.account?.hasOpenIDLink
    }
  },
  methods: {
    close() {
      // Force close when navigating - used in UsersTable
      if (this.$refs.modal) this.$refs.modal.setHide()
    },
    unlinkOpenID() {
      const payload = {
        message: this.$strings.MessageConfirmUnlinkOpenId,
        callback: (confirmed) => {
          if (confirmed) {
            this.unlinkingFromOpenID = true
            this.$axios
              .$patch(`/api/users/${this.account.id}/openid-unlink`)
              .then(() => {
                this.$toast.success(this.$strings.ToastUnlinkOpenIdSuccess)
                this.show = false
              })
              .catch((error) => {
                console.error('Failed to unlink user from OpenID', error)
                this.$toast.error(this.$strings.ToastUnlinkOpenIdFailed)
              })
              .finally(() => {
                this.unlinkingFromOpenID = false
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    accessAllTagsToggled(val) {
      if (val) {
        if (this.newUser.itemTagsSelected?.length) {
          this.newUser.itemTagsSelected = []
        }
        this.newUser.permissions.selectedTagsNotAccessible = false
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
      if (!val && !this.newUser.librariesAccessible.length) {
        this.newUser.librariesAccessible = this.libraries.map((l) => l.id)
      } else if (val && this.newUser.librariesAccessible.length) {
        this.newUser.librariesAccessible = []
      }
    },
    submitForm() {
      if (!this.newUser.username) {
        this.$toast.error(this.$strings.ToastNewUserUsernameError)
        return
      }
      if (!this.newUser.permissions.accessAllLibraries && !this.newUser.librariesAccessible.length) {
        this.$toast.error(this.$strings.ToastNewUserLibraryError)
        return
      }
      if (!this.newUser.permissions.accessAllTags && !this.newUser.itemTagsSelected.length) {
        this.$toast.error(this.$strings.ToastNewUserTagError)
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
      this.$axios
        .$patch(`/api/users/${this.account.id}`, account)
        .then((data) => {
          this.processing = false
          if (data.error) {
            this.$toast.error(`${this.$strings.ToastFailedToUpdate}: ${data.error}`)
          } else {
            console.log('Account updated', data.user)

            if (data.user.id === this.user.id && data.user.accessToken !== this.user.accessToken) {
              console.log('Current user access token was updated')
              this.$store.commit('user/setAccessToken', data.user.accessToken)
            }

            this.$toast.success(this.$strings.ToastAccountUpdateSuccess)
            this.show = false
          }
        })
        .catch((error) => {
          this.processing = false
          console.error('Failed to update account', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(errMsg || this.$strings.ToastFailedToUpdate)
        })
    },
    submitCreateAccount() {
      if (!this.newUser.password) {
        this.$toast.error(this.$strings.ToastNewUserPasswordError)
        return
      }

      var account = { ...this.newUser }
      this.processing = true
      this.$axios
        .$post('/api/users', account)
        .then((data) => {
          this.processing = false
          if (data.error) {
            this.$toast.error(this.$strings.ToastNewUserCreatedFailed + ': ' + data.error)
          } else {
            this.$toast.success(this.$strings.ToastNewUserCreatedSuccess)
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
    userTypeUpdated(type) {
      this.newUser.permissions = {
        download: type !== 'guest',
        update: type === 'admin',
        delete: type === 'admin',
        upload: type === 'admin',
        accessExplicitContent: type === 'admin',
        accessAllLibraries: true,
        accessAllTags: true,
        selectedTagsNotAccessible: false,
        createEreader: type === 'admin'
      }
    },
    init() {
      this.fetchAllTags()
      this.isNew = !this.account

      if (this.account) {
        this.newUser = {
          username: this.account.username,
          email: this.account.email,
          password: this.account.password,
          type: this.account.type,
          isActive: this.account.isActive,
          permissions: { ...this.account.permissions },
          librariesAccessible: [...(this.account.librariesAccessible || [])],
          itemTagsSelected: [...(this.account.itemTagsSelected || [])]
        }
      } else {
        this.newUser = {
          username: null,
          email: null,
          password: null,
          type: 'user',
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
            createEreader: false
          },
          librariesAccessible: [],
          itemTagsSelected: []
        }
      }
    }
  },
  mounted() {}
}
</script>
