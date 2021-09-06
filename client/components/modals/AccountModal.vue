<template>
  <modals-modal v-model="show" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300">
        <div class="w-full p-8">
          <div class="flex py-2 -mx-2">
            <div class="w-1/2 px-2">
              <ui-text-input-with-label v-model="newUser.username" label="Username" class="mx-2" />
            </div>
            <div class="w-1/2 px-2">
              <ui-text-input-with-label v-if="!isEditingRoot" v-model="newUser.password" :label="isNew ? 'Password' : 'Change Password'" type="password" class="mx-2" />
            </div>
          </div>
          <div class="flex py-2">
            <div class="px-2">
              <ui-input-dropdown v-model="newUser.type" label="Account Type" :disabled="isEditingRoot" :editable="false" :items="accountTypes" @input="userTypeUpdated" />
            </div>
            <div class="flex-grow" />
            <div v-show="!isEditingRoot" class="flex items-center pt-4 px-2">
              <p class="px-3 font-semibold" :class="isEditingRoot ? 'text-gray-300' : ''">Is Active</p>
              <ui-toggle-switch v-model="newUser.isActive" :disabled="isEditingRoot" />
            </div>
          </div>

          <div v-if="!isEditingRoot && newUser.permissions" class="w-full border-t border-b border-black-200 py-2 mt-4">
            <p class="text-lg mb-2">Permissions</p>
            <div class="flex items-center my-2 max-w-lg">
              <div class="w-1/2">
                <p>Can Download</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.download" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-lg">
              <div class="w-1/2">
                <p>Can Update</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.update" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-lg">
              <div class="w-1/2">
                <p>Can Delete</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.delete" />
              </div>
            </div>
          </div>

          <div class="flex pt-4">
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
      accountTypes: ['guest', 'user', 'admin']
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
      return this.isNew ? 'Add New Account' : `Update Account: ${(this.account || {}).username}`
    },
    isEditingRoot() {
      return this.account && this.account.type === 'root'
    }
  },
  methods: {
    submitForm() {
      if (!this.newUser.username) {
        this.$toast.error('Enter a username')
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
        .$patch(`/api/user/${this.account.id}`, account)
        .then((data) => {
          this.processing = false
          if (data.error) {
            this.$toast.error(`Failed to update account: ${data.error}`)
          } else {
            this.$toast.success('Account updated')
            this.show = false
          }
        })
        .catch((error) => {
          console.error('Failed to update account', error)
          this.processing = false
          this.$toast.error('Failed to update account')
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
        .$post('/api/user', account)
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
          console.error('Failed to create account', error)
          this.processing = false
          this.$toast.error('Failed to create account')
        })
    },
    toggleActive() {
      this.newUser.isActive = !this.newUser.isActive
    },
    userTypeUpdated(type) {
      this.newUser.permissions = {
        download: type !== 'guest',
        update: type === 'admin',
        delete: type === 'admin'
      }
    },
    init() {
      this.isNew = !this.account
      if (this.account) {
        this.newUser = {
          username: this.account.username,
          password: this.account.password,
          type: this.account.type,
          isActive: this.account.isActive,
          permissions: { ...this.account.permissions }
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
            delete: false
          }
        }
      }
    }
  },
  mounted() {}
}
</script>
