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
            <div class="grow" />
            <ui-btn v-show="(password && newPassword && confirmPassword) || isRoot" type="submit" :loading="changingPassword" color="bg-success">{{ $strings.ButtonSubmit }}</ui-btn>
          </div>
        </form>
      </div>

      <div v-if="showEreaderTable">
        <div class="w-full h-px bg-white/10 my-4" />

        <app-settings-content :header-text="$strings.HeaderEreaderDevices">
          <template #header-items>
            <div class="grow" />

            <ui-btn color="bg-primary" small @click="addNewDeviceClick">{{ $strings.ButtonAddDevice }}</ui-btn>
          </template>

          <table v-if="ereaderDevices.length" class="tracksTable mt-4">
            <tr>
              <th class="text-left">{{ $strings.LabelName }}</th>
              <th class="text-left">{{ $strings.LabelEmail }}</th>
              <th class="w-40"></th>
            </tr>
            <tr v-for="device in ereaderDevices" :key="device.name">
              <td>
                <p class="text-sm md:text-base text-gray-100">{{ device.name }}</p>
              </td>
              <td class="text-left">
                <p class="text-sm md:text-base text-gray-100">{{ device.email }}</p>
              </td>
              <td class="w-40">
                <div class="flex justify-end items-center h-10">
                  <ui-icon-btn icon="edit" borderless :size="8" icon-font-size="1.1rem" :disabled="deletingDeviceName === device.name || device.users?.length !== 1" class="mx-1" @click="editDeviceClick(device)" />
                  <ui-icon-btn icon="delete" borderless :size="8" icon-font-size="1.1rem" :disabled="deletingDeviceName === device.name || device.users?.length !== 1" @click="deleteDeviceClick(device)" />
                </div>
              </td>
            </tr>
          </table>
          <div v-else-if="!loading" class="text-center py-4">
            <p class="text-lg text-gray-100">{{ $strings.MessageNoDevices }}</p>
          </div>
        </app-settings-content>
      </div>

      <div class="py-4 mt-8 flex">
        <ui-btn color="bg-primary flex items-center text-lg" @click="logout"><span class="material-symbols mr-4 icon-text">logout</span>{{ $strings.ButtonLogout }}</ui-btn>
      </div>

      <modals-emails-user-e-reader-device-modal v-model="showEReaderDeviceModal" :existing-devices="revisedEreaderDevices" :ereader-device="selectedEReaderDevice" @update="ereaderDevicesUpdated" />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      password: null,
      newPassword: null,
      confirmPassword: null,
      changingPassword: false,
      selectedLanguage: '',
      newEReaderDevice: {
        name: '',
        email: ''
      },
      ereaderDevices: [],
      deletingDeviceName: null,
      selectedEReaderDevice: null,
      showEReaderDeviceModal: false
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
    },
    showEreaderTable() {
      return this.usertype !== 'root' && this.usertype !== 'admin' && this.user.permissions?.createEreader
    },
    revisedEreaderDevices() {
      return this.ereaderDevices.filter((device) => device.users?.length === 1)
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
        return this.$toast.error(this.$strings.ToastUserPasswordMismatch)
      }
      if (this.password === this.newPassword) {
        return this.$toast.error(this.$strings.ToastUserPasswordMustChange)
      }
      this.changingPassword = true
      this.$axios
        .$patch('/api/me/password', {
          password: this.password,
          newPassword: this.newPassword
        })
        .then(() => {
          this.$toast.success(this.$strings.ToastUserPasswordChangeSuccess)
          this.resetForm()
        })
        .catch((error) => {
          console.error('Failed to change password', error)
          let errorMessage = this.$strings.ToastUnknownError
          if (error.response?.data && typeof error.response.data === 'string') {
            errorMessage = error.response.data
          }
          this.$toast.error(errorMessage)
        })
        .finally(() => {
          this.changingPassword = false
        })
    },
    addNewDeviceClick() {
      this.selectedEReaderDevice = null
      this.showEReaderDeviceModal = true
    },
    editDeviceClick(device) {
      this.selectedEReaderDevice = device
      this.showEReaderDeviceModal = true
    },
    deleteDeviceClick(device) {
      const payload = {
        message: this.$getString('MessageConfirmDeleteDevice', [device.name]),
        callback: (confirmed) => {
          if (confirmed) {
            this.deleteDevice(device)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    deleteDevice(device) {
      const payload = {
        ereaderDevices: this.revisedEreaderDevices.filter((d) => d.name !== device.name)
      }
      this.deletingDeviceName = device.name
      this.$axios
        .$post(`/api/me/ereader-devices`, payload)
        .then((data) => {
          this.ereaderDevicesUpdated(data.ereaderDevices)
        })
        .catch((error) => {
          console.error('Failed to delete device', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.deletingDeviceName = null
        })
    },
    ereaderDevicesUpdated(ereaderDevices) {
      this.ereaderDevices = ereaderDevices
    }
  },
  mounted() {
    this.selectedLanguage = this.$languageCodes.current
    this.ereaderDevices = this.$store.state.libraries.ereaderDevices || []
  }
}
</script>
