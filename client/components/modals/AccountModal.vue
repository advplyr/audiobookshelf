<template>
  <modals-modal v-model="show" :width="800" :height="500" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300">
        <div class="w-full p-8">
          <div class="flex py-2">
            <ui-text-input-with-label v-model="newUser.username" label="Username" class="mx-2" />
            <ui-text-input-with-label v-model="newUser.password" label="Password" type="password" class="mx-2" />
          </div>
          <div class="flex py-2">
            <div class="px-2">
              <ui-input-dropdown v-model="newUser.type" label="Account Type" :editable="false" :items="accountTypes" />
            </div>
            <div class="flex-grow" />
            <div class="flex items-center pt-4 px-2">
              <p class="px-3 font-semibold">Is Active</p>
              <ui-toggle-switch v-model="newUser.isActive" />
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
      return this.isNew ? 'Add New Account' : `Update "${(this.account || {}).username}" Account`
    }
  },
  methods: {
    submitForm() {
      if (!this.newUser.username) {
        this.$toast.error('Enter a username')
        return
      }
      if (!this.newUser.password) {
        this.$toast.error('Must have a password, only root user can have an empty password')
        return
      }

      var account = { ...this.newUser }
      this.processing = true
      if (this.isNew) {
        this.$axios
          .$post('/api/user', account)
          .then((data) => {
            this.processing = false
            if (data.error) {
              this.$toast.error(`Failed to create account: ${data.error}`)
            } else {
              console.log('New Account:', data.user)
              this.$toast.success('New account created')
              this.show = false
            }
          })
          .catch((error) => {
            console.error('Failed to create account', error)
            this.processing = false
            this.$toast.success('New account created')
          })
      }
    },
    toggleActive() {
      this.newUser.isActive = !this.newUser.isActive
    },
    init() {
      this.isNew = !this.account
      if (this.account) {
        this.newUser = {
          username: this.account.username,
          password: this.account.password,
          type: this.account.type,
          isActive: this.account.isActive
        }
      } else {
        this.newUser = {
          username: null,
          password: null,
          type: 'user',
          isActive: true
        }
      }
    }
  },
  mounted() {}
}
</script>
