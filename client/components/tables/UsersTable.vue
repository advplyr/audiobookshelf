<template>
  <div>
    <div class="text-center">
      <table id="accounts">
        <tr>
          <th>{{ $strings.LabelUsername }}</th>
          <th class="w-20">{{ $strings.LabelAccountType }}</th>
          <th class="hidden lg:table-cell">{{ $strings.LabelActivity }}</th>
          <th class="w-32 hidden sm:table-cell">{{ $strings.LabelLastSeen }}</th>
          <th class="w-32 hidden sm:table-cell">{{ $strings.LabelCreatedAt }}</th>
          <th class="w-32"></th>
        </tr>
        <tr v-for="user in users" :key="user.id" class="cursor-pointer" :class="user.isActive ? '' : 'bg-error bg-opacity-20'" @click="$router.push(`/config/users/${user.id}`)">
          <td>
            <div class="flex items-center">
              <widgets-online-indicator :value="!!usersOnline[user.id]" />
              <p class="pl-2 truncate">{{ user.username }}</p>
            </div>
          </td>
          <td class="text-sm">{{ user.type }}</td>
          <td class="hidden lg:table-cell">
            <div v-if="usersOnline[user.id]">
              <p v-if="usersOnline[user.id].session && usersOnline[user.id].session.libraryItem" class="truncate text-xs">Listening: {{ usersOnline[user.id].session.libraryItem.media.metadata.title || '' }}</p>
              <p v-else-if="usersOnline[user.id].mostRecent && usersOnline[user.id].mostRecent.media" class="truncate text-xs">Last: {{ usersOnline[user.id].mostRecent.media.metadata.title }}</p>
            </div>
          </td>
          <td class="text-xs font-mono hidden sm:table-cell">
            <ui-tooltip v-if="user.lastSeen" direction="top" :text="$formatDate(user.lastSeen, 'MMMM do, yyyy HH:mm')">
              {{ $dateDistanceFromNow(user.lastSeen) }}
            </ui-tooltip>
          </td>
          <td class="text-xs font-mono hidden sm:table-cell">
            <ui-tooltip direction="top" :text="$formatDate(user.createdAt, 'MMMM do, yyyy HH:mm')">
              {{ $formatDate(user.createdAt, 'MMM d, yyyy') }}
            </ui-tooltip>
          </td>
          <td class="py-0">
            <div class="w-full flex justify-center">
              <!-- Dont show edit for non-root users -->
              <div v-if="user.type !== 'root' || userIsRoot" class="h-8 w-8 flex items-center justify-center text-white text-opacity-50 hover:text-opacity-100 cursor-pointer" @click.stop="editUser(user)">
                <span class="material-icons text-base">edit</span>
              </div>
              <div v-show="user.type !== 'root'" class="h-8 w-8 flex items-center justify-center text-white text-opacity-50 hover:text-error cursor-pointer" @click.stop="deleteUserClick(user)">
                <span class="material-icons text-base">delete</span>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <modals-account-modal ref="accountModal" v-model="showAccountModal" :account="selectedAccount" />
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
    userIsRoot() {
      return this.$store.getters['user/getIsRoot']
    },
    usersOnline() {
      var usermap = {}
      this.$store.state.users.usersOnline.forEach((u) => (usermap[u.id] = u))
      return usermap
    }
  },
  methods: {
    deleteUserClick(user) {
      if (this.isDeletingUser) return
      if (confirm(this.$getString('MessageRemoveUserWarning', [user.username]))) {
        this.isDeletingUser = true
        this.$axios
          .$delete(`/api/users/${user.id}`)
          .then((data) => {
            this.isDeletingUser = false
            if (data.error) {
              this.$toast.error(data.error)
            } else {
              this.$toast.success(this.$strings.ToastUserDeleteSuccess)
            }
          })
          .catch((error) => {
            console.error('Failed to delete user', error)
            this.$toast.error(this.$strings.ToastUserDeleteFailed)
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
          this.users = users.sort((a, b) => {
            return a.createdAt - b.createdAt
          })
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
    if (this.$refs.accountModal) {
      this.$refs.accountModal.close()
    }

    if (this.$root.socket) {
      this.$root.socket.off('user_added', this.addUpdateUser)
      this.$root.socket.off('user_updated', this.addUpdateUser)
      this.$root.socket.off('user_removed', this.userRemoved)
    }
  }
}
</script>

<style>
#accounts {
  table-layout: fixed;
  border-collapse: collapse;
  border: 1px solid #474747;
  width: 100%;
}

#accounts td,
#accounts th {
  /* border: 1px solid #2e2e2e; */
  padding: 8px 8px;
  text-align: left;
}

#accounts td.py-0 {
  padding: 0px 8px;
}

#accounts tr:nth-child(even) {
  background-color: #373838;
}

#accounts tr:nth-child(odd) {
  background-color: #2f2f2f;
}

#accounts tr:hover {
  background-color: #444;
}

#accounts th {
  font-size: 0.8rem;
  font-weight: 600;
  padding-top: 5px;
  padding-bottom: 5px;
  background-color: #272727;
}
</style>