<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full max-w-xl mx-auto">
      <h1 class="text-2xl">{{ $strings.HeaderAccount }}</h1>

      <div class="my-4">
        <div class="flex -mx-2">
          <div class="w-2/3 px-2">
            <ui-text-input-with-label disabled :value="username" :label="$strings.LabelUsername" />
          </div>
          <div class="w-1/3 px-2">
            <ui-text-input-with-label disabled :value="usertype" :label="$strings.LabelAccountType" />
          </div>
        </div>
        <div class="py-4">
          <p class="px-1 text-sm font-semibold">{{ $strings.LabelLanguage }}</p>
          <ui-dropdown v-model="selectedLanguage" :items="$languageCodeOptions" small class="max-w-48" @input="updateLocalLanguage" />
        </div>

        <div class="w-full h-px bg-white/10 my-4" />

        <p v-if="showChangePasswordForm" class="mb-4 text-lg">{{ $strings.HeaderChangePassword }}</p>
        <form v-if="showChangePasswordForm" @submit.prevent="submitChangePassword">
          <ui-text-input-with-label v-model="password" :disabled="changingPassword" type="password" :label="$strings.LabelPassword" class="my-2" />
          <ui-text-input-with-label v-model="newPassword" :disabled="changingPassword" type="password" :label="$strings.LabelNewPassword" class="my-2" />
          <ui-text-input-with-label v-model="confirmPassword" :disabled="changingPassword" type="password" :label="$strings.LabelConfirmPassword" class="my-2" />
          <div class="flex items-center py-2">
            <p v-if="isRoot" class="text-error py-2 text-xs">* {{ $strings.NoteChangeRootPassword }}</p>
            <div class="flex-grow" />
            <ui-btn v-show="(password && newPassword && confirmPassword) || isRoot" type="submit" :loading="changingPassword" color="success">{{ $strings.ButtonSubmit }}</ui-btn>
          </div>
        </form>
      </div>

      <div class="py-4 mt-8 flex">
        <ui-btn color="primary flex items-center text-lg" @click="logout"><span class="material-icons mr-4 icon-text">logout</span>{{ $strings.ButtonLogout }}</ui-btn>
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
      changingPassword: false,
      selectedLanguage: ''
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
    },
    isGuest() {
      return this.usertype === 'guest'
    },
    isPasswordAuthEnabled() {
      const activeAuthMethods = this.$store.getters['getServerSetting']('authActiveAuthMethods') || []
      return activeAuthMethods.includes('local')
    },
    showChangePasswordForm() {
      return !this.isGuest && this.isPasswordAuthEnabled
    }
  },
  methods: {
    updateLocalLanguage(lang) {
      this.$setLanguageCode(lang)
    },
    logout() {
      // Disconnect from socket
      if (this.$root.socket) {
        console.log('Disconnecting from socket', this.$root.socket.id)
        this.$root.socket.removeAllListeners()
        this.$root.socket.disconnect()
      }

      if (localStorage.getItem('token')) {
        localStorage.removeItem('token')
      }
      this.$store.commit('libraries/setUserPlaylists', [])
      this.$store.commit('libraries/setCollections', [])

      this.$axios
        .$post('/logout')
        .then((logoutPayload) => {
          const redirect_url = logoutPayload.redirect_url

          if (redirect_url) {
            window.location.href = redirect_url
          } else {
            this.$router.push('/login')
          }
        })
        .catch((error) => {
          console.error(error)
        })
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
  mounted() {
    this.selectedLanguage = this.$languageCodes.current
  }
}
</script>