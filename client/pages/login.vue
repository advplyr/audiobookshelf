<template>
  <div class="w-full h-screen bg-bg">
    <div class="w-full flex h-full items-center justify-center">
      <div v-if="criticalError" class="w-full max-w-md rounded border border-error border-opacity-25 bg-error bg-opacity-10 p-4">
        <p class="text-center text-lg font-semibold">{{ $strings.MessageServerCouldNotBeReached }}</p>
      </div>
      <div v-else-if="showInitScreen" class="w-full max-w-lg px-4 md:px-8 pb-8 pt-4">
        <p class="text-3xl text-white text-center mb-4">Initial Server Setup</p>
        <div class="w-full h-px bg-white bg-opacity-10 my-4" />

        <form @submit.prevent="submitServerSetup">
          <p class="text-lg font-semibold mb-2 pl-1 text-center">Create Root User</p>
          <ui-text-input-with-label v-model="newRoot.username" label="Username" :disabled="processing" class="w-full mb-3 text-sm" />
          <ui-text-input-with-label v-model="newRoot.password" label="Password" type="password" :disabled="processing" class="w-full mb-3 text-sm" />
          <ui-text-input-with-label v-model="confirmPassword" label="Confirm Password" type="password" :disabled="processing" class="w-full mb-3 text-sm" />

          <p class="text-lg font-semibold mt-6 mb-2 pl-1 text-center">Directory Paths</p>
          <ui-text-input-with-label v-model="ConfigPath" label="Config Path" disabled class="w-full mb-3 text-sm" />
          <ui-text-input-with-label v-model="MetadataPath" label="Metadata Path" disabled class="w-full mb-3 text-sm" />

          <div class="w-full flex justify-end py-3">
            <ui-btn type="submit" :disabled="processing" color="primary" class="leading-none">{{ processing ? 'Initializing...' : $strings.ButtonSubmit }}</ui-btn>
          </div>
        </form>
      </div>
      <div v-else-if="isInit" class="w-full max-w-md px-8 pb-8 pt-4 -mt-40">
        <p class="text-3xl text-white text-center mb-4">{{ $strings.HeaderLogin }}</p>
        <div class="w-full h-px bg-white bg-opacity-10 my-4" />
        <p v-if="error" class="text-error text-center py-2">{{ error }}</p>
        <form id="login-local" @submit.prevent="submitForm">
          <label class="text-xs text-gray-300 uppercase">{{ $strings.LabelUsername }}</label>
          <ui-text-input v-model="username" :disabled="processing" class="mb-3 w-full" />

          <label class="text-xs text-gray-300 uppercase">{{ $strings.LabelPassword }}</label>
          <ui-text-input v-model="password" type="password" :disabled="processing" class="w-full mb-3" />
          <div class="w-full flex justify-end py-3">
            <ui-btn type="submit" :disabled="processing" color="primary" class="leading-none">{{ processing ? 'Checking...' : $strings.ButtonSubmit }}</ui-btn>
          </div>
        </form>
        <hr />
        <div class="w-full flex py-3">
          <a id="login-google-oauth20" :href="`http://localhost:3333/auth/google?callback=${currentUrl}`">
            <ui-btn color="primary" class="leading-none">Login with Google</ui-btn>
          </a>
          <a id="login-openid" :href="`http://localhost:3333/auth/openid?callback=${currentUrl}`">
            <ui-btn color="primary" class="leading-none">Login with OpenId</ui-btn>
          </a>
        </div>
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
      criticalError: null,
      processing: false,
      username: '',
      password: null,
      showInitScreen: false,
      isInit: false,
      newRoot: {
        username: 'root',
        password: ''
      },
      confirmPassword: '',
      ConfigPath: '',
      MetadataPath: '',
      currentUrl: location.toString()
    }
  },
  watch: {
    user(newVal) {
      if (newVal) {
        if (!this.$store.state.libraries.currentLibraryId) {
          // No libraries available to this user
          if (this.$store.getters['user/getIsRoot']) {
            // If root user go to config/libraries
            this.$router.replace('/config/libraries')
          } else {
            this.$router.replace('/oops?message=No libraries available')
          }
        } else {
          if (this.$route.query.redirect) {
            const isAdminUser = this.$store.getters['user/getIsAdminOrUp']
            const redirect = this.$route.query.redirect
            // If not admin user then do not redirect to config pages other than your stats
            if (isAdminUser || !redirect.startsWith('/config/') || redirect === '/config/stats') {
              this.$router.replace(redirect)
              return
            }
          }

          this.$router.replace(`/library/${this.$store.state.libraries.currentLibraryId}`)
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
    async submitServerSetup() {
      if (!this.newRoot.username || !this.newRoot.username.trim()) {
        this.$toast.error('Must enter a root username')
        return
      }
      if (this.newRoot.password !== this.confirmPassword) {
        this.$toast.error('Password mismatch')
        return
      }
      if (!this.newRoot.password) {
        if (!confirm('Are you sure you want to create the root user with no password?')) {
          return
        }
      }
      this.processing = true

      const payload = {
        newRoot: { ...this.newRoot }
      }
      const success = await this.$axios
        .$post('/init', payload)
        .then(() => true)
        .catch((error) => {
          console.error('Failed', error.response)
          const errorMsg = error.response ? error.response.data || 'Unknown Error' : 'Unknown Error'
          this.$toast.error(errorMsg)
          return false
        })

      if (!success) {
        this.processing = false
        return
      }

      location.reload()
    },
    setUser({ user, userDefaultLibraryId, serverSettings, Source, ereaderDevices }) {
      this.$store.commit('setServerSettings', serverSettings)
      this.$store.commit('setSource', Source)
      this.$store.commit('libraries/setEReaderDevices', ereaderDevices)
      this.$setServerLanguageCode(serverSettings.language)

      if (serverSettings.chromecastEnabled) {
        console.log('Chromecast enabled import script')
        require('@/plugins/chromecast.js').default(this)
      }

      this.$store.commit('libraries/setCurrentLibrary', userDefaultLibraryId)
      this.$store.commit('user/setUser', user)

      this.$store.dispatch('user/loadUserSettings')
    },
    async submitForm() {
      this.error = null
      this.processing = true

      const payload = {
        username: this.username,
        password: this.password || ''
      }
      const authRes = await this.$axios.$post('/login', payload).catch((error) => {
        console.error('Failed', error.response)
        if (error.response) this.error = error.response.data
        else this.error = 'Unknown Error'
        return false
      })

      if (authRes?.error) {
        this.error = authRes.error
      } else if (authRes) {
        this.setUser(authRes)
      }
      this.processing = false
    },
    checkAuth() {
      const token = localStorage.getItem('token')
      if (!token) return false

      this.processing = true

      return this.$axios
        .$post('/api/authorize', null, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        .then((res) => {
          this.setUser(res)
          this.processing = false
          return true
        })
        .catch((error) => {
          console.error('Authorize error', error)
          this.processing = false
          return false
        })
    },
    checkStatus() {
      this.processing = true
      this.$axios
        .$get('/status')
        .then((res) => {
          this.processing = false
          this.isInit = res.isInit
          this.showInitScreen = !res.isInit
          this.$setServerLanguageCode(res.language)
          if (this.showInitScreen) {
            this.ConfigPath = res.ConfigPath || ''
            this.MetadataPath = res.MetadataPath || ''
          }
        })
        .catch((error) => {
          console.error('Status check failed', error)
          this.processing = false
          this.criticalError = 'Status check failed'
        })
    },
    async updateLoginVisibility() {
      await this.$axios
        .$get('/auth_methods')
        .then((response) => {
          ;['local', 'google-oauth20', 'openid'].forEach((auth_method) => {
            debugger
            if (response.includes(auth_method)) {
              // TODO: show `#login-${auth_method}`
            } else {
              // TODO: hide `#login-${auth_method}`
            }
          })
        })
        .catch((error) => {
          console.error('Failed', error.response)
          return false
        })
    }
  },
  async mounted() {
    this.updateLoginVisibility()
    if (new URLSearchParams(window.location.search).get('setToken')) {
      localStorage.setItem('token', new URLSearchParams(window.location.search).get('setToken'))
    }
    if (localStorage.getItem('token')) {
      var userfound = await this.checkAuth()
      if (userfound) return // if valid user no need to check status
    }
    this.checkStatus()
  }
}
</script>