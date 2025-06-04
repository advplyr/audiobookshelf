<template>
  <div class="page-container">
    <div class="max-w-6xl mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <widgets-loading-spinner />
      </div>

      <!-- Content when loaded -->
      <template v-else>
        <div v-if="user" class="mb-8">
          <h1 class="text-3xl font-semibold mb-2">{{ user.displayName || user.username }}</h1>
          <p class="text-gray-400">Member since {{ formatDate(user.createdAt) }}</p>
        </div>

        <!-- Tab Navigation -->
        <div v-if="user" class="flex border-b border-white/10 mb-6">
          <button class="px-4 py-2 mr-4 font-semibold" :class="activeTab === 'account' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'" @click="activeTab = 'account'">Account Settings</button>
          <button class="px-4 py-2 font-semibold" :class="activeTab === 'reviews' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'" @click="activeTab = 'reviews'">Reviews</button>
        </div>

        <!-- Reviews Tab -->
        <div v-if="activeTab === 'reviews'" class="space-y-6 pb-24">
          <div v-if="reviews.length" class="space-y-6">
            <h2 class="text-2xl font-semibold mb-4">Reviews</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div v-for="review in reviews" :key="review.id" class="bg-primary rounded-lg overflow-hidden shadow-lg flex flex-col">
                <nuxt-link :to="'/item/' + review.libraryItemId" class="block flex-shrink-0" style="height: 280px">
                  <div class="relative h-full w-full flex items-center justify-center">
                    <covers-book-cover v-if="review.libraryItem" :library-item="review.libraryItem" :width="180" :book-cover-aspect-ratio="bookCoverAspectRatio" class="hover:scale-105 transition-transform duration-200" />
                    <div v-else class="absolute inset-0 bg-gray-700 flex items-center justify-center">
                      <span class="material-symbols text-4xl text-gray-400">book</span>
                    </div>
                  </div>
                </nuxt-link>

                <div class="p-4 flex-grow">
                  <nuxt-link :to="'/item/' + review.libraryItemId" class="block">
                    <h3 class="text-lg font-semibold mb-2 hover:text-white transition-colors line-clamp-1">{{ review.libraryItem?.title || 'Unknown Book' }}</h3>
                  </nuxt-link>

                  <div class="flex mb-3">
                    <span v-for="star in 5" :key="star" class="abs-icons icon-star" :class="star <= review.rating ? 'text-yellow-500' : 'text-gray-500'"></span>
                  </div>

                  <p class="text-gray-300 text-sm mb-2 line-clamp-3">{{ review.text }}</p>
                  <p class="text-gray-400 text-xs">{{ formatDate(review.createdAt) }}</p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-gray-400">{{ user.username }} hasn't written any reviews yet.</div>
        </div>

        <!-- Account Tab -->
        <div v-if="activeTab === 'account' && isCurrentUser" class="max-w-xl">
          <div class="my-4">
            <div class="flex -mx-2">
              <div class="w-2/3 px-2">
                <ui-text-input-with-label disabled :value="user.username" label="Username" />
              </div>
              <div class="w-1/3 px-2">
                <ui-text-input-with-label disabled :value="user.type" label="Account Type" />
              </div>
            </div>
            <form @submit.prevent="submitDisplayName">
              <div class="flex -mx-2 mt-4">
                <div class="w-2/3 px-2">
                  <ui-text-input-with-label v-model="displayNameInput" label="Display Name" />
                </div>
                <div class="px-2 flex items-end">
                  <ui-btn type="submit" color="bg-success">Update</ui-btn>
                </div>
              </div>
            </form>

            <div class="py-4">
              <p class="px-1 text-sm font-semibold">Language</p>
              <ui-dropdown v-model="selectedLanguage" :items="$languageCodeOptions" small class="max-w-48" @input="updateLocalLanguage" />
            </div>

            <div class="w-full h-px bg-white/10 my-4" />

            <div v-if="showChangePasswordForm">
              <p class="mb-4 text-lg">Change Password</p>
              <form @submit.prevent="submitChangePassword">
                <ui-text-input-with-label v-model="password" :disabled="changingPassword" type="password" label="Current Password" class="my-2" />
                <ui-text-input-with-label v-model="newPassword" :disabled="changingPassword" type="password" label="New Password" class="my-2" />
                <ui-text-input-with-label v-model="confirmPassword" :disabled="changingPassword" type="password" label="Confirm Password" class="my-2" />
                <div class="flex items-center py-2">
                  <p v-if="isRoot" class="text-error py-2 text-xs">* Root user password changes affect the server configuration</p>
                  <div class="grow" />
                  <ui-btn v-show="(password && newPassword && confirmPassword) || isRoot" type="submit" :loading="changingPassword" color="bg-success">Submit</ui-btn>
                </div>
              </form>
            </div>

            <div v-if="showEreaderTable">
              <div class="w-full h-px bg-white/10 my-4" />
              <app-settings-content header-text="E-Reader Devices">
                <template #header-items>
                  <div class="grow" />
                  <ui-btn color="bg-primary" small @click="addNewDeviceClick">Add Device</ui-btn>
                </template>

                <table v-if="ereaderDevices.length" class="tracksTable mt-4">
                  <tr>
                    <th class="text-left">Name</th>
                    <th class="text-left">Email</th>
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
                  <p class="text-lg text-gray-100">No devices added yet</p>
                </div>
              </app-settings-content>
            </div>

            <div class="py-4 mt-8 flex">
              <ui-btn color="bg-primary flex items-center text-lg" @click="logout"> <span class="material-symbols mr-4 icon-text">logout</span>Logout </ui-btn>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-if="!user && !loading" class="text-center py-12">
          <p class="text-error text-lg">Error loading user profile</p>
        </div>
      </template>
    </div>

    <modals-emails-user-e-reader-device-modal v-if="isCurrentUser" v-model="showEReaderDeviceModal" :existing-devices="revisedEreaderDevices" :ereader-device="selectedEReaderDevice" @update="ereaderDevicesUpdated" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      user: null,
      reviews: [],
      activeTab: 'account',
      loading: true,
      // Account tab data
      password: null,
      newPassword: null,
      confirmPassword: null,
      changingPassword: false,
      selectedLanguage: '',
      displayNameInput: '',
      ereaderDevices: [],
      deletingDeviceName: null,
      selectedEReaderDevice: null,
      showEReaderDeviceModal: false
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    isCurrentUser() {
      return this.user?.id === this.$store.state.user.user?.id
    },
    isRoot() {
      return this.user?.type === 'root'
    },
    isGuest() {
      return this.user?.type === 'guest'
    },
    isPasswordAuthEnabled() {
      const activeAuthMethods = this.$store.getters['getServerSetting']('authActiveAuthMethods') || []
      return activeAuthMethods.includes('local')
    },
    showChangePasswordForm() {
      return !this.isGuest && this.isPasswordAuthEnabled
    },
    showEreaderTable() {
      return this.user?.type !== 'root' && this.user?.type !== 'admin' && this.user?.permissions?.createEreader
    },
    revisedEreaderDevices() {
      return this.ereaderDevices.filter((device) => device.users?.length === 1)
    }
  },
  methods: {
    formatDate(date) {
      return new Date(date).toLocaleDateString()
    },
    async loadUser() {
      try {
        this.user = await this.$axios.$get('/api/users/' + this.$route.params.id)
        if (this.isCurrentUser) {
          this.displayNameInput = this.user.displayName || ''
          this.selectedLanguage = this.$languageCodes.current
          await this.loadEreaderDevices()
        }
      } catch (error) {
        console.error('Error loading user:', error)
        this.$toast.error('Error loading user profile')
      }
    },
    async loadReviews() {
      try {
        const reviews = await this.$axios.$get('/api/users/' + this.$route.params.id + '/reviews')
        this.reviews = reviews
      } catch (error) {
        console.error('Error loading reviews:', error)
        this.$toast.error('Error loading reviews')
      }
    },
    async loadEreaderDevices() {
      try {
        const response = await this.$axios.$get('/api/users/' + this.user.id + '/ereader-devices')
        this.ereaderDevices = response.devices || []
      } catch (error) {
        console.error('Error loading e-reader devices:', error)
      }
    },
    updateLocalLanguage(lang) {
      this.$setLanguageCode(lang)
    },
    async submitDisplayName() {
      try {
        await this.$axios.$patch('/api/users/' + this.user.id, {
          displayName: this.displayNameInput
        })
        this.$toast.success('Display name updated')
        await this.loadUser()
      } catch (error) {
        console.error('Error updating display name:', error)
        this.$toast.error('Error updating display name')
      }
    },
    async submitChangePassword() {
      if (this.newPassword !== this.confirmPassword) {
        return this.$toast.error('Passwords do not match')
      }
      if (this.password === this.newPassword) {
        return this.$toast.error('New password must be different')
      }
      this.changingPassword = true
      try {
        await this.$axios.$patch('/api/me/password', {
          password: this.password,
          newPassword: this.newPassword
        })
        this.$toast.success('Password updated successfully')
        this.password = null
        this.newPassword = null
        this.confirmPassword = null
      } catch (error) {
        console.error('Error updating password:', error)
        this.$toast.error('Error updating password')
      } finally {
        this.changingPassword = false
      }
    },
    addNewDeviceClick() {
      this.selectedEReaderDevice = null
      this.showEReaderDeviceModal = true
    },
    editDeviceClick(device) {
      this.selectedEReaderDevice = device
      this.showEReaderDeviceModal = true
    },
    async deleteDeviceClick(device) {
      try {
        this.deletingDeviceName = device.name
        await this.$axios.$delete(`/api/users/${this.user.id}/ereader-devices/${device.name}`)
        this.$toast.success('Device removed')
        await this.loadEreaderDevices()
      } catch (error) {
        console.error('Error deleting device:', error)
        this.$toast.error('Error removing device')
      } finally {
        this.deletingDeviceName = null
      }
    },
    async ereaderDevicesUpdated() {
      await this.loadEreaderDevices()
    },
    logout() {
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
    async init() {
      this.loading = true
      try {
        await this.loadUser()
        await this.loadReviews()
      } finally {
        this.loading = false
      }
    }
  },
  async mounted() {
    this.init()
  }
}
</script>

<style>
.page-container {
  min-height: 100vh;
  height: 100vh;
  overflow-y: auto;
  background-color: var(--bg-color);
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tracksTable {
  width: 100%;
  border-collapse: collapse;
}

.tracksTable th,
.tracksTable td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tracksTable th {
  font-weight: 600;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
}
</style> 