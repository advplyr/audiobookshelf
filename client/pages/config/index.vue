<template>
  <div class="page p-6" :class="streamAudiobook ? 'streaming' : ''">
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
          </tr>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.username }}</td>
            <td>{{ user.type }}</td>
            <td class="text-sm font-mono">
              {{ new Date(user.createdAt).toISOString() }}
            </td>
          </tr>
        </table>
      </div>
      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />
      <div class="py-4 mb-8">
        <div class="flex items-start py-2">
          <p class="text-2xl">Scanner</p>
          <div class="flex-grow" />
          <div class="w-40 flex flex-col">
            <ui-btn color="success" class="mb-4" :loading="isScanning" :disabled="isScanningCovers" @click="scan">Scan</ui-btn>
            <ui-btn color="primary" small :padding-x="2" :loading="isScanningCovers" :disabled="isScanning" @click="scanCovers">Scan for Covers</ui-btn>
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
  </div>
</template>

<script>
export default {
  data() {
    return {
      isResettingAudiobooks: false,
      users: null
    }
  },
  computed: {
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
    clickAddUser() {
      this.$toast.info('Under Construction: User management coming soon.')
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
    }
  },
  mounted() {
    this.loadUsers()
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