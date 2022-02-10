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
        <div v-if="ssoAvailable" class="w-full flex justify-end">
          <a href="/oidc/login"><ui-btn :disabled="processing" class="bg-blue-600 hover:bg-blue-800 px-8 py-1 mt-3 rounded-md text-white text-center transition duration-300 ease-in-out focus:outline-none">SSO</ui-btn></a>
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
      processing: false,
      username: '',
      password: null,
      ssoAvailable: false
    }
  },
  watch: {
    user(newVal) {
      if (newVal) {
        if (this.$route.query.redirect) {
          this.$router.replace(this.$route.query.redirect)
        } else {
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
    setUser(user) {
      // If user is not able to access main library, then set current library
      // var userLibrariesAccessible = this.$store.getters['user/getLibrariesAccessible']
      var userCanAccessAll = user.permissions ? !!user.permissions.accessAllLibraries : false
      if (!userCanAccessAll) {
        var accessibleLibraries = user.librariesAccessible || []
        console.log('Setting user without all library access', accessibleLibraries)
        if (accessibleLibraries.length && !accessibleLibraries.includes('main')) {
          console.log('Setting current library', accessibleLibraries[0])
          this.$store.commit('libraries/setCurrentLibrary', accessibleLibraries[0])
        }
      }
      // if (userLibrariesAccessible.length && !userLibrariesAccessible.includes('main')) {
      //   this.$store.commit('libraries/setCurrentLibrary', userLibrariesAccessible[0])
      // }

      this.$store.commit('user/setUser', user)
    },
    async submitForm() {
      this.error = null
      this.processing = true

      var payload = {
        username: this.username,
        password: this.password || ''
      }
      var authRes = await this.$axios.$post('/login', payload).catch((error) => {
        console.error('Failed', error.response)
        if (error.response) this.error = error.response.data
        else this.error = 'Unknown Error'
        return false
      })
      if (authRes && authRes.error) {
        this.error = authRes.error
      } else if (authRes) {
        this.setUser(authRes.user)
      }
      this.processing = false
    },
    getCookies() {
      return document.cookie.split(";").map(c => c.split("=")).reduce((acc, val)=> {
          return {
              ...acc,
              [val[0]]: val[1]
          }
      }, {})
    },
    deleteCookie(name, path="/", domain=document.location.host) {
      document.cookie = name + "=" +
        ((path) ? ";path="+path:"")+
        ((domain)?";domain="+domain:"") +
        ";expires=Thu, 01 Jan 1970 00:00:01 GMT";
    },
    checkAuth() {
      if (this.getCookies()["sso"]) {
        this.processing = true

        this.$axios
          .$post('/api/authorize', null, {})
          .then((res) => {
            this.setUser(res.user)
            this.processing = false
          })
          .catch((error) => {
            console.error('Authorize error', error)
            this.deleteCookie("sso")
            this.processing = false
          })
        return;
      }
      if (localStorage.getItem('token')) {
        let token = localStorage.getItem('token')

        if (token) {
          this.processing = true

          this.$axios
            .$post('/api/authorize', null, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            })
            .then((res) => {
              this.setUser(res.user)
              this.processing = false
            })
            .catch((error) => {
              console.error('Authorize error', error)
              this.processing = false
            })
        }
      }
    },
    async checkSSO() {
      const res = await fetch("/oidc/login", {mode: "no-cors"})
      if (res.status >= 400 && res.status < 600) {
        this.ssoAvailable = false
        return
      }
      this.ssoAvailable = true
    }
  },
  mounted() {
    this.checkAuth()
    this.checkSSO()
  }
}
</script>