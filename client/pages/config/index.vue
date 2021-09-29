<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto" :class="streamAudiobook ? 'streaming' : ''">
    <div class="w-full max-w-4xl mx-auto">
      <div class="flex items-center mb-2">
        <h1 class="text-2xl">Users</h1>
        <div class="mx-2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center" @click="clickAddUser">
          <span class="material-icons" style="font-size: 1.4rem">add</span>
        </div>
        <!-- <ui-btn small :padding-x="4" class="h-8">Create User</ui-btn> -->
      </div>
      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />
      <div class="p-4 text-center">
        <table id="accounts" class="mb-8">
          <tr>
            <th>Username</th>
            <th>Account Type</th>
            <th style="width: 200px">Created At</th>
            <th style="width: 100px"></th>
          </tr>
          <tr v-for="user in users" :key="user.id" :class="user.isActive ? '' : 'bg-error bg-opacity-20'">
            <td>
              {{ user.username }} <span class="text-xs text-gray-400 italic pl-4">({{ user.id }})</span>
            </td>
            <td>{{ user.type }}</td>
            <td class="text-sm font-mono">
              {{ new Date(user.createdAt).toISOString() }}
            </td>
            <td>
              <div class="w-full flex justify-center">
                <span class="material-icons hover:text-gray-400 cursor-pointer text-base pr-2" @click="editUser(user)">edit</span>
                <span v-show="user.type !== 'root'" class="material-icons text-base hover:text-error cursor-pointer" @click="deleteUserClick(user)">delete</span>
              </div>
            </td>
          </tr>
        </table>
      </div>
      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />
      <div class="py-4 mb-8">
        <p class="text-2xl">Scanner</p>
        <div class="flex items-start py-2">
          <div class="py-2">
            <div class="flex items-center">
              <ui-toggle-switch v-model="newServerSettings.scannerParseSubtitle" @input="updateScannerParseSubtitle" />
              <ui-tooltip :text="parseSubtitleTooltip">
                <p class="pl-4 text-lg">Parse Subtitles <span class="material-icons icon-text">info_outlined</span></p>
              </ui-tooltip>
            </div>
          </div>
          <div class="flex-grow" />
          <div class="w-40 flex flex-col">
            <ui-btn color="success" class="mb-4" :loading="isScanning" :disabled="isScanningCovers" @click="scan">Scan</ui-btn>

            <div class="w-full mb-4">
              <ui-tooltip direction="bottom" text="Only scans audiobooks without a cover. Covers will be applied if a close match is found." class="w-full">
                <ui-btn color="primary" class="w-full" small :padding-x="2" :loading="isScanningCovers" :disabled="isScanning" @click="scanCovers">Scan for Covers</ui-btn>
              </ui-tooltip>
            </div>

            <!-- <ui-btn color="primary" small @click="saveMetadataFiles">Save Metadata</ui-btn> -->
          </div>
        </div>
      </div>

      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />

      <div class="flex items-center py-4">
        <ui-btn color="bg" small :padding-x="4" :loading="isResettingAudiobooks" @click="resetAudiobooks">Reset All Audiobooks</ui-btn>
      </div>

      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />

      <div class="flex items-center py-4">
        <p class="font-mono">v{{ $config.version }}</p>
        <div class="flex-grow" />
        <p class="pr-2 text-sm font-book text-yellow-400">Report bugs, request features, provide feedback, and contribute on <a class="underline" href="https://github.com/advplyr/audiobookshelf" target="_blank">github</a>.</p>
        <a href="https://github.com/advplyr/audiobookshelf" target="_blank" class="text-white hover:text-gray-200 hover:scale-150 hover:rotate-6 transform duration-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
            />
          </svg>
        </a>
      </div>
    </div>
    <div class="fixed bottom-0 left-0 w-10 h-10" @dblclick="setDeveloperMode"></div>

    <modals-account-modal v-model="showAccountModal" :account="selectedAccount" />
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsRoot']) {
      redirect('/?error=unauthorized')
    }
  },
  data() {
    return {
      isResettingAudiobooks: false,
      users: [],
      selectedAccount: null,
      showAccountModal: false,
      isDeletingUser: false,
      newServerSettings: {}
    }
  },
  watch: {
    serverSettings(newVal, oldVal) {
      if (newVal && !oldVal) {
        this.newServerSettings = { ...this.serverSettings }
      }
    }
  },
  computed: {
    parseSubtitleTooltip() {
      return 'Extract subtitles from audiobook directory names.<br>Subtitle must be seperated by " - "<br>i.e. "Book Title - A Subtitle Here" has the subtitle "A Subtitle Here"'
    },
    serverSettings() {
      return this.$store.state.serverSettings
    },
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    isScanning() {
      return this.$store.state.isScanning
    },
    isScanningCovers() {
      return this.$store.state.isScanningCovers
    }
  },
  methods: {
    updateScannerParseSubtitle(val) {
      var payload = {
        scannerParseSubtitle: val
      }
      this.$store
        .dispatch('updateServerSettings', payload)
        .then((success) => {
          console.log('Updated Server Settings', success)
        })
        .catch((error) => {
          console.error('Failed to update server settings', error)
        })
    },
    setDeveloperMode() {
      var value = !this.$store.state.developerMode
      this.$store.commit('setDeveloperMode', value)
      this.$toast.info(`Developer Mode ${value ? 'Enabled' : 'Disabled'}`)
    },
    scan() {
      this.$root.socket.emit('scan')
    },
    scanCovers() {
      this.$root.socket.emit('scan_covers')
    },
    saveMetadataFiles() {
      this.$root.socket.emit('save_metadata')
    },
    loadUsers() {
      this.$axios
        .$get('/api/users')
        .then((users) => {
          this.users = users
        })
        .catch((error) => {
          console.error('Failed', error)
        })
    },
    resetAudiobooks() {
      if (confirm('WARNING! This action will remove all audiobooks from the database including any updates or matches you have made. This does not do anything to your actual files. Shall we continue?')) {
        this.isResettingAudiobooks = true
        this.$axios
          .$delete('/api/audiobooks')
          .then(() => {
            this.isResettingAudiobooks = false
            this.$toast.success('Successfully reset audiobooks')
          })
          .catch((error) => {
            console.error('failed to reset audiobooks', error)
            this.isResettingAudiobooks = false
            this.$toast.error('Failed to reset audiobooks - stop docker and manually remove appdata')
          })
      }
    },
    clickAddUser() {
      this.selectedAccount = null
      this.showAccountModal = true
    },
    editUser(user) {
      this.selectedAccount = user
      this.showAccountModal = true
    },
    deleteUserClick(user) {
      if (this.isDeletingUser) return
      if (confirm(`Are you sure you want to permanently delete user "${user.username}"?`)) {
        this.isDeletingUser = true
        this.$axios
          .$delete(`/api/user/${user.id}`)
          .then((data) => {
            this.isDeletingUser = false
            if (data.error) {
              this.$toast.error(data.error)
            } else {
              this.$toast.success('User deleted')
            }
          })
          .catch((error) => {
            console.error('Failed to delete user', error)
            this.$toast.error('Failed to delete user')
            this.isDeletingUser = false
          })
      }
    },
    addUpdateUser(user) {
      if (!this.users) return
      var index = this.users.findIndex((u) => u.id === user.id)
      if (index >= 0) {
        this.users.splice(index, 1, user)
      } else {
        this.users.push(user)
      }
    },
    userRemoved(user) {
      this.users = this.users.filter((u) => u.id !== user.id)
    },
    init(attempts = 0) {
      if (!this.$root.socket) {
        if (attempts > 10) {
          return console.error('Failed to setup socket listeners')
        }
        setTimeout(() => {
          this.init(++attempts)
        }, 250)
        return
      }
      this.$root.socket.on('user_added', this.addUpdateUser)
      this.$root.socket.on('user_updated', this.addUpdateUser)
      this.$root.socket.on('user_removed', this.userRemoved)

      this.newServerSettings = this.serverSettings ? { ...this.serverSettings } : {}
    }
  },
  mounted() {
    this.loadUsers()
    this.init()
  },
  beforeDestroy() {
    if (this.$root.socket) {
      this.$root.socket.off('user_added', this.newUserAdded)
      this.$root.socket.off('user_updated', this.userUpdated)
    }
  }
}
</script>

<style>
#accounts {
  table-layout: fixed;
  border-collapse: collapse;
  width: 100%;
}

#accounts td,
#accounts th {
  border: 1px solid #2e2e2e;
  padding: 8px 8px;
  text-align: left;
}

#accounts tr:nth-child(even) {
  background-color: #3a3a3a;
}

#accounts tr:hover {
  background-color: #444;
}

#accounts th {
  font-size: 0.8rem;
  font-weight: 600;
  padding-top: 5px;
  padding-bottom: 5px;
  background-color: #333;
}
</style>