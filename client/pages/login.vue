<template>
  <div class="w-full h-screen bg-bg">
    <div class="w-full flex h-1/2 items-center justify-center">
      <div class="w-full max-w-md border border-opacity-0 rounded-xl px-8 pb-8 pt-4">
        <p class="text-3xl text-white text-center mb-4">Login</p>
        <div class="w-full h-px bg-white bg-opacity-10 my-4" />
        <p v-if="error" class="text-error text-center py-2">{{ error }}</p>
        <form @submit.prevent="submitForm">
          <label class="text-xs text-gray-300 uppercase">Username</label>
          <ui-text-input v-model="username" :disabled="processing" class="mb-3 w-full" />

          <label class="text-xs text-gray-300 uppercase">Password</label>
          <ui-text-input v-model="password" type="password" :disabled="processing" class="w-full mb-3" />
          <div class="w-full flex justify-end">
            <button type="submit" :disabled="processing" class="bg-blue-600 hover:bg-blue-800 px-8 py-1 mt-3 rounded-md text-white text-center transition duration-300 ease-in-out focus:outline-none">{{ processing ? 'Checking...' : 'Submit' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'blank',
  data() {
    return {
      error: null,
      processing: false,
      username: 'root',
      password: null
    }
  },
  watch: {
    user(newVal) {
      if (newVal) {
        if (this.$route.query.redirect) {
          this.$router.replace(this.$route.query.redirect)
        } else {
          this.$router.replace('/')
        }
      }
    }
  },
  computed: {
    user() {
      return this.$store.state.user.user
    }
  },
  methods: {
    async submitForm() {
      this.error = null
      this.processing = true

      var payload = {
        username: this.username,
        password: this.password || ''
      }
      var authRes = await this.$axios.$post('/login', payload).catch((error) => {
        console.error('Failed', error)
        return false
      })
      console.log('Auth res', authRes)
      if (!authRes) {
        this.error = 'Unknown Failure'
      } else if (authRes.error) {
        this.error = authRes.error
      } else {
        this.$store.commit('user/setUser', authRes.user)
      }
      this.processing = false
    },
    checkAuth() {
      if (localStorage.getItem('token')) {
        var token = localStorage.getItem('token')

        if (token) {
          this.processing = true

          console.log('Authorize', token)
          this.$axios
            .$post('/api/authorize', null, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            })
            .then((res) => {
              this.$store.commit('user/setUser', res.user)
              this.processing = false
            })
            .catch((error) => {
              console.error('Authorize error', error)
              this.processing = false
            })
        }
      }
    }
  },
  mounted() {
    this.checkAuth()
  }
}
</script>