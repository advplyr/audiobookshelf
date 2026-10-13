<template>
  <div id="page-wrapper" class="w-full h-screen overflow-y-auto">
    <div class="login-glow pointer-events-none" aria-hidden="true" />
    <div class="absolute z-0 top-0 left-0 px-6 py-5">
      <div class="flex items-center">
        <img src="~static/icon.svg" alt="Audiobookshelf Logo" class="w-9 min-w-9 h-9" />
        <h1 class="font-display text-xl ml-3 hidden sm:block">audiobook<span class="text-accent">shelf</span></h1>
      </div>
    </div>

    <div class="relative z-10 w-full flex h-full items-center justify-center lg:justify-between lg:px-[8vw] gap-16">
      <div v-if="isInit && !criticalError && !showInitScreen" class="hidden lg:block max-w-xl login-hero">
        <p class="text-xs uppercase tracking-[0.35em] text-accent/80 mb-6">Self-hosted · Audiobooks · Podcasts</p>
        <p class="font-display text-6xl xl:text-7xl leading-[1.05] text-gray-50">audiobook<span class="italic text-accent">shelf</span></p>
        <div class="mt-8 flex items-end gap-1 h-10" aria-hidden="true">
          <span v-for="n in 28" :key="n" class="login-wave w-1 rounded-full bg-accent/60" :style="{ animationDelay: (n % 7) * 0.12 + 's', height: 20 + ((n * 37) % 80) + '%' }" />
        </div>
      </div>
      <div v-if="criticalError" class="w-full max-w-md rounded-sm border border-error/25 bg-error/10 p-4">
        <p class="text-center text-lg font-semibold">{{ $strings.MessageServerCouldNotBeReached }}</p>
      </div>
      <div v-else-if="showInitScreen" class="w-full max-w-lg px-4 md:px-8 pb-8 pt-4">
        <p class="text-3xl text-white text-center mb-4">Initial Server Setup</p>
        <div class="w-full h-px bg-white/10 my-4" />

        <form @submit.prevent="submitServerSetup">
          <p class="text-lg font-semibold mb-2 pl-1 text-center">Create Root User</p>
          <ui-text-input-with-label v-model.trim="newRoot.username" label="Username" autocomplete="username" :disabled="processing" class="w-full mb-3 text-sm" />
          <ui-text-input-with-label v-model="newRoot.password" label="Password" type="password" autocomplete="new-password" :disabled="processing" class="w-full mb-3 text-sm" />
          <ui-text-input-with-label v-model="confirmPassword" label="Confirm Password" type="password" autocomplete="new-password" :disabled="processing" class="w-full mb-3 text-sm" />

          <p class="text-lg font-semibold mt-6 mb-2 pl-1 text-center">Directory Paths</p>
          <ui-text-input-with-label v-model="ConfigPath" label="Config Path" disabled class="w-full mb-3 text-sm" />
          <ui-text-input-with-label v-model="MetadataPath" label="Metadata Path" disabled class="w-full mb-3 text-sm" />

          <div class="w-full flex justify-end py-3">
            <ui-btn type="submit" :disabled="processing" color="bg-primary" class="leading-none">{{ processing ? 'Initializing...' : $strings.ButtonSubmit }}</ui-btn>
          </div>
        </form>
      </div>
      <div v-else-if="isInit" class="w-full max-w-md px-6 pb-8 pt-4">
        <div class="bg-primary/80 backdrop-blur-xl rounded-2xl box-shadow-xl border border-white/10 px-6 py-8 sm:px-8">
          <p class="font-display text-3xl text-white mb-1">{{ $strings.HeaderLogin }}</p>
          <div class="w-10 h-0.5 bg-accent rounded-full mt-3 mb-6" />

          <p v-if="loginCustomMessage" class="py-2 default-style mb-2" v-html="loginCustomMessage"></p>

          <p v-if="error" class="text-error text-center py-2">{{ error }}</p>

          <div v-if="showNewAuthSystemMessage" class="mb-4">
            <widgets-alert type="warning">
              <div>
                <p>{{ $strings.MessageAuthenticationSecurityMessage }}</p>
                <a v-if="showNewAuthSystemAdminMessage" href="https://github.com/advplyr/audiobookshelf/discussions/4460" target="_blank" class="underline">{{ $strings.LabelMoreInfo }}</a>
              </div>
            </widgets-alert>
          </div>

          <form v-show="login_local" @submit.prevent="submitForm">
            <label class="block text-xs text-gray-400 tracking-wider uppercase mb-1.5">{{ $strings.LabelUsername }}</label>
            <ui-text-input v-model.trim="username" autocomplete="username" :disabled="processing" class="mb-4 w-full h-11" inputName="username" />

            <label class="block text-xs text-gray-400 tracking-wider uppercase mb-1.5">{{ $strings.LabelPassword }}</label>
            <ui-text-input v-model.trim="password" type="password" autocomplete="current-password" :disabled="processing" class="w-full mb-4 h-11" inputName="password" />
            <div class="w-full pt-2">
              <ui-btn type="submit" :disabled="processing" color="bg-accent" class="w-full h-11 leading-none text-black-700! font-semibold">{{ processing ? 'Checking...' : $strings.ButtonSubmit }}</ui-btn>
            </div>
          </form>

          <div v-if="login_local && login_openid" class="w-full h-px bg-white/10 my-4" />

          <div class="w-full flex py-3">
            <a v-if="login_openid" :href="openidAuthUri" class="w-full abs-btn outline-hidden rounded-lg relative border border-white/15 text-center bg-white/5 text-white px-8 py-3 leading-none">
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
      authFormData: null,
      // New JWT auth system re-login flags
      showNewAuthSystemMessage: false,
      showNewAuthSystemAdminMessage: false
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

      this.$store.commit('libraries/setLastLoad', 0) // Ensure libraries get loaded again when switching users
      this.$store.commit('libraries/setCurrentLibrary', { id: userDefaultLibraryId })
      this.$store.commit('user/setUser', user)
      // Access token only returned from login, not authorize
      if (user.accessToken) {
        this.$store.commit('user/setAccessToken', user.accessToken)
      }

      this.$store.dispatch('user/loadUserSettings')
    },
    async submitForm() {
      this.error = null
      this.showNewAuthSystemMessage = false
      this.showNewAuthSystemAdminMessage = false
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

      this.$store.commit('user/setAccessToken', token)

      return this.$axios
        .$post('/api/authorize', null, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        .then((res) => {
          // Force re-login if user is using an old token with no expiration
          if (res.user.isOldToken) {
            this.username = res.user.username
            this.showNewAuthSystemMessage = true
            // Admin user sees link to github discussion
            this.showNewAuthSystemAdminMessage = res.user.type === 'admin' || res.user.type === 'root'
            return false
          }

          this.setUser(res)
          return true
        })
        .catch((error) => {
          console.error('Authorize error', error)
          return false
        })
        .finally(() => {
          this.processing = false
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
        // Auto redirect unless query string ?autoLaunch=0 OR when explicity requested through ?autoLaunch=1
        if ((this.authFormData?.authOpenIDAutoLaunch && this.$route.query?.autoLaunch !== '0') || this.$route.query?.autoLaunch == '1') {
          window.location.href = this.openidAuthUri
        }

        this.login_openid = true
      } else {
        this.login_openid = false
      }
    }
  },
  async mounted() {
    // Token passed as query parameter after successful oidc login
    if (this.$route.query?.accessToken) {
      localStorage.setItem('token', this.$route.query.accessToken)
    }
    if (localStorage.getItem('token')) {
      if (await this.checkAuth()) return // if valid user no need to check status
    }

    this.checkStatus()
  }
}
</script>

<style>
.login-glow {
  position: fixed;
  inset: 0;
  background: radial-gradient(700px 500px at 20% 40%, rgb(var(--accent-rgb) / 0.12), transparent 65%), radial-gradient(600px 500px at 90% 90%, rgb(var(--glow2-rgb) / 0.08), transparent 60%);
}

.login-hero {
  animation: login-rise 900ms var(--ease-out-expo) both;
}

.login-wave {
  animation: login-wave 1.6s ease-in-out infinite alternate;
  transform-origin: bottom;
}

@keyframes login-wave {
  from {
    transform: scaleY(0.35);
    opacity: 0.5;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}

@keyframes login-rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
