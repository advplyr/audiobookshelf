<template>
  <div class="w-full h-full p-8">
    <div class="w-full max-w-2xl mx-auto">
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
            <ui-btn type="submit" :loading="changingPassword" color="success">Submit</ui-btn>
          </div>
        </form>
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
        .$patch('/api/user/password', {
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