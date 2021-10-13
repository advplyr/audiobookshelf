<template>
  <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
    <div class="flex items-center mb-2">
      <h1 class="text-xl">Users</h1>
      <div class="mx-2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center" @click="clickAddUser">
        <span class="material-icons" style="font-size: 1.4rem">add</span>
      </div>
    </div>
    <!-- <div class="h-0.5 bg-primary bg-opacity-50 w-full" /> -->
    <div class="text-center">
      <table id="accounts">
        <tr>
          <th>Username</th>
          <th class="w-20">Type</th>
          <th>Activity</th>
          <th class="w-32">Last Seen</th>
          <th class="w-32">Created</th>
          <th class="w-32"></th>
        </tr>
        <tr v-for="user in users" :key="user.id" :class="user.isActive ? '' : 'bg-error bg-opacity-20'">
          <td>
            <div class="flex items-center">
              <span v-if="usersOnline[user.id]" class="w-3 h-3 text-sm mr-2 text-success animate-pulse"
                ><svg viewBox="0 0 24 24">
                  <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" /></svg
              ></span>
              <svg v-else class="w-3 h-3 mr-2 text-white text-opacity-20" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
              </svg>
              {{ user.username }} <span v-show="$isDev" class="text-xs text-gray-400 italic pl-4">({{ user.id }})</span>
            </div>
          </td>
          <td class="text-sm">{{ user.type }}</td>
          <td>
            <div v-if="usersOnline[user.id] && usersOnline[user.id].stream && usersOnline[user.id].stream.audiobook && usersOnline[user.id].stream.audiobook.book">
              <p class="truncate text-xs">Reading: {{ usersOnline[user.id].stream.audiobook.book.title || '' }}</p>
            </div>
            <div v-else-if="user.audiobooks && getLastRead(user.audiobooks)">
              <p class="truncate text-xs">Last: {{ getLastRead(user.audiobooks) }}</p>
            </div>
          </td>
          <td class="text-xs font-mono">
            <ui-tooltip v-if="user.lastSeen" direction="top" :text="$formatDate(user.lastSeen, 'MMMM do, yyyy HH:mm')">
              {{ $dateDistanceFromNow(user.lastSeen) }}
            </ui-tooltip>
          </td>
          <td class="text-xs font-mono">
            <ui-tooltip direction="top" :text="$formatDate(user.createdAt, 'MMMM do, yyyy HH:mm')">
              {{ $formatDate(user.createdAt, 'MMM d, yyyy') }}
            </ui-tooltip>
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

    <modals-account-modal v-model="showAccountModal" :account="selectedAccount" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      users: [],
      selectedAccount: null,
      showAccountModal: false,
      isDeletingUser: false
    }
  },
  computed: {
    currentUserId() {
      return this.$store.state.user.user.id
    },
    userStream() {
      return this.$store.state.streamAudiobook
    },
    usersOnline() {
      var _users = this.$store.state.users.users

      var currUserStream = null
      if (this.userStream) {
        currUserStream = {
          audiobook: this.userStream
        }
      }
      var usermap = {
        [this.currentUserId]: {
          online: true,
          stream: currUserStream
        }
      }
      _users.forEach((u) => (usermap[u.id] = { online: true, stream: u.stream }))
      return usermap
    }
  },
  methods: {
    getLastRead(audiobooks) {
      var abs = Object.values(audiobooks)
      if (abs.length) {
        abs = abs.sort((a, b) => a.lastUpdate - b.lastUpdate)
        return abs[0] && abs[0].audiobookTitle ? abs[0].audiobookTitle : null
      }
      return null
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
    clickAddUser() {
      this.selectedAccount = null
      this.showAccountModal = true
    },
    editUser(user) {
      this.selectedAccount = user
      this.showAccountModal = true
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
      this.$root.socket.off('user_removed', this.userRemoved)
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