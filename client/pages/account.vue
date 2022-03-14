<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full max-w-xl mx-auto">
      <h1 class="text-2xl">Account</h1>

      <div class="my-4">
        <div class="flex -mx-2">
          <div class="w-2/3 px-2">
            <ui-text-input-with-label disabled :value="username" label="Username" />
          </div>
          <div class="w-1/3 px-2">
            <ui-text-input-with-label disabled :value="usertype" label="Account Type" />
          </div>
        </div>

        <div class="w-full h-px bg-primary my-4" />

        <p class="mb-4 text-lg">Change Password</p>
        <form @submit.prevent="submitChangePassword">
          <ui-text-input-with-label v-model="password" :disabled="changingPassword" type="password" label="Password" class="my-2" />
          <ui-text-input-with-label v-model="newPassword" :disabled="changingPassword" type="password" label="New Password" class="my-2" />
          <ui-text-input-with-label v-model="confirmPassword" :disabled="changingPassword" type="password" label="Confirm Password" class="my-2" />
          <div class="flex items-center py-2">
            <p v-if="isRoot" class="text-error py-2 text-xs">* Root user is the only user that can have an empty password</p>
            <div class="flex-grow" />
            <ui-btn v-show="(password && newPassword && confirmPassword) || isRoot" type="submit" :loading="changingPassword" color="success">Submit</ui-btn>
          </div>
        </form>
      </div>

      <div class="py-4 mt-8 flex">
        <ui-btn color="primary flex items-center text-lg" @click="logout"><span class="material-icons mr-4 icon-text">logout</span>Logout</ui-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      password: null,
      newPassword: null,
      confirmPassword: null,
      changingPassword: false
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    user() {
      return this.$store.state.user.user || null
    },
    username() {
      return this.user.username
    },
    usertype() {
      return this.user.type
    },
    isRoot() {
      return this.usertype === 'root'
    }
  },
  methods: {
    logout() {
      var rootSocket = this.$root.socket || {}
      const logoutPayload = {
        socketId: rootSocket.id
      }
      this.$axios.$post('/logout', logoutPayload).catch((error) => {
        console.error(error)
      })
      if (localStorage.getItem('token')) {
        localStorage.removeItem('token')
      }
      this.$router.push('/login')
    },
    resetForm() {
      this.password = null
      this.newPassword = null
      this.confirmPassword = null
    },
    submitChangePassword() {
      if (this.newPassword !== this.confirmPassword) {
        return this.$toast.error('New password and confirm password do not match')
      }
      if (this.password === this.newPassword) {
        return this.$toast.error('Password and New Password cannot be the same')
      }
      this.changingPassword = true
      this.$axios
        .$patch('/api/me/password', {
          password: this.password,
          newPassword: this.newPassword
        })
        .then((res) => {
          if (res.success) {
            this.$toast.success('Password Changed Successfully')
            this.resetForm()
          } else {
            this.$toast.error(res.error || 'Unknown Error')
          }
          this.changingPassword = false
        })
        .catch((error) => {
          console.error(error)
          this.$toast.error('Api call failed')
          this.changingPassword = false
        })
    }
  },
  mounted() {}
}
</script>