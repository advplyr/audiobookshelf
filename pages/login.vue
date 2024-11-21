<template>
  <div id="page-wrapper" class="w-full h-screen overflow-y-auto">
    <div class="absolute z-0 top-0 left-0 px-6 py-3">
      <div class="flex items-center">
        <img src="~static/icon.svg" alt="Audiobookshelf Logo" class="w-10 min-w-10 h-10" />
        <h1 class="text-xl ml-4 hidden lg:block hover:underline">audiobookshelf</h1>
      </div>
    </div>

    <div class="relative z-10 w-full flex h-full items-center justify-center">
      <div v-if="criticalError" class="w-full max-w-md rounded border border-error border-opacity-25 bg-error bg-opacity-10 p-4">
        <p class="text-center text-lg font-semibold">{{ $strings.MessageServerCouldNotBeReached }}</p>
      </div>
      <div v-else-if="showInitScreen" class="w-full max-w-lg px-4 md:px-8 pb-8 pt-4">
        <p class="text-3xl text-white text-center mb-4">Initial Server Setup</p>
        <div class="w-full h-px bg-white bg-opacity-10 my-4" />

        <form @submit.prevent="submitServerSetup">
          <p class="text-lg font-semibold mb-2 pl-1 text-center">Create Root User</p>
          <ui-text-input-with-label v-model.trim="newRoot.username" label="Username" :disabled="processing" class="w-full mb-3 text-sm" />
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
      <div v-else-if="isInit" class="w-full max-w-md px-8 pb-8 pt-4 lg:-mt-40">
        <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4">
          <p class="text-2xl font-semibold text-center text-white mb-4">{{ $strings.HeaderLogin }}</p>

          <div class="w-full h-px bg-white bg-opacity-10 my-4" />

          <p v-if="loginCustomMessage" class="py-2 default-style mb-2" v-html="loginCustomMessage"></p>

          <p v-if="error" class="text-error text-center py-2">{{ error }}</p>

          <form v-show="login_local" @submit.prevent="submitForm">
            <label class="text-xs text-gray-300 uppercase">{{ $strings.LabelUsername }}</label>
            <ui-text-input v-model.trim="username" :disabled="processing" class="mb-3 w-full" inputName="username" />

            <label class="text-xs text-gray-300 uppercase">{{ $strings.LabelPassword }}</label>
            <ui-text-input v-model.trim="password" type="password" :disabled="processing" class="w-full mb-3" inputName="password" />
            <div class="w-full flex justify-end py-3">
              <ui-btn type="submit" :disabled="processing" color="primary" class="leading-none">{{ processing ? 'Checking...' : $strings.ButtonSubmit }}</ui-btn>
            </div>
          </form>

          <div v-if="login_local && login_openid" class="w-full h-px bg-white bg-opacity-10 my-4" />

          <div class="w-full flex py-3">
            <a v-if="login_openid" :href="openidAuthUri" class="w-full abs-btn outline-none rounded-md shadow-md relative border border-gray-600 text-center bg-primary text-white px-8 py-2 leading-none">
              {{ openIDButtonText }}
            </a>
          </div>
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
      login_local: true,
      login_openid: false,
      authFormData: null
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
    },
    openidAuthUri() {
      return `${process.env.serverUrl}/auth/openid?callback=${location.href.split('?').shift()}`
    },
    openIDButtonText() {
      return this.authFormData?.authOpenIDButtonText || 'Login with OpenId'
    },
    loginCustomMessage() {
      return this.authFormData?.authLoginCustomMessage || null
    }
  },
  methods: {
    async submitServerSetup() {
      if (!this.newRoot.username || !this.newRoot.username.trim()) {
        this.$toast.error(this.$strings.ToastUserRootRequireName)
        return
      }
      if (this.newRoot.password !== this.confirmPassword) {
        this.$toast.error(this.$strings.ToastUserPasswordMismatch)
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
        .then((data) => {
          this.isInit = data.isInit
          this.showInitScreen = !data.isInit
          this.$setServerLanguageCode(data.language)
          if (this.showInitScreen) {
            this.ConfigPath = data.ConfigPath || ''
            this.MetadataPath = data.MetadataPath || ''
          } else {
            this.authFormData = data.authFormData
            this.updateLoginVisibility(data.authMethods || [])
          }
        })
        .catch((error) => {
          console.error('Status check failed', error)
          this.criticalError = 'Status check failed'
        })
        .finally(() => {
          this.processing = false
        })
    },
    updateLoginVisibility(authMethods) {
      if (this.$route.query?.error) {
        this.error = this.$route.query.error

        // Remove error query string
        const newurl = new URL(location.href)
        newurl.searchParams.delete('error')
        window.history.replaceState({ path: newurl.href }, '', newurl.href)
      }

      if (authMethods.includes('local') || !authMethods.length) {
        this.login_local = true
      } else {
        this.login_local = false
      }

      if (authMethods.includes('openid')) {
        // Auto redirect unless query string ?autoLaunch=0
        if (this.authFormData?.authOpenIDAutoLaunch && this.$route.query?.autoLaunch !== '0') {
          window.location.href = this.openidAuthUri
        }

        this.login_openid = true
      } else {
        this.login_openid = false
      }
    }
  },
  async mounted() {
    if (this.$route.query?.setToken) {
      localStorage.setItem('token', this.$route.query.setToken)
    }
    if (localStorage.getItem('token')) {
      if (await this.checkAuth()) return // if valid user no need to check status
    }

    this.checkStatus()
  }
}
</script>
