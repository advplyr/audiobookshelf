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
        <tr v-for="user in users" :key="user.id" class="cursor-pointer" :class="user.isActive ? '' : '!bg-error/10'" @click="$router.push(`/config/users/${user.id}`)">
          <td>
            <div class="flex items-center">
              <widgets-online-indicator :value="!!usersOnline[user.id]" />
              <p class="pl-2 truncate">{{ user.username }}</p>
            </div>
          </td>
          <td class="text-sm">{{ user.type }}</td>
          <td class="hidden lg:table-cell">
            <div v-if="usersOnline[user.id]?.session?.displayTitle">
              <p class="truncate text-xs">Listening: {{ usersOnline[user.id].session.displayTitle || '' }}</p>
              <p class="truncate text-xs text-gray-300">{{ getDeviceInfoString(usersOnline[user.id].session.deviceInfo) }}</p>
            </div>
            <div v-else-if="user.latestSession?.displayTitle">
              <p class="truncate text-xs">Last: {{ user.latestSession.displayTitle || '' }}</p>
              <p class="truncate text-xs text-gray-300">{{ getDeviceInfoString(user.latestSession.deviceInfo) }}</p>
            </div>
          </td>
          <td class="text-xs font-mono hidden sm:table-cell">
            <ui-tooltip v-if="user.lastSeen" direction="top" :text="$formatDatetime(user.lastSeen, dateFormat, timeFormat)">
              {{ $dateDistanceFromNow(user.lastSeen) }}
            </ui-tooltip>
          </td>
          <td class="text-xs font-mono hidden sm:table-cell">
            <ui-tooltip direction="top" :text="$formatDatetime(user.createdAt, dateFormat, timeFormat)">
              {{ $formatDate(user.createdAt, dateFormat) }}
            </ui-tooltip>
          </td>
          <td class="py-0">
            <div class="w-full flex justify-left">
              <!-- Dont show edit for non-root users -->
              <div v-if="user.type !== 'root' || userIsRoot" class="h-8 w-8 flex items-center justify-center text-white text-opacity-50 hover:text-opacity-100 cursor-pointer" @click.stop="editUser(user)">
                <button type="button" :aria-label="$getString('ButtonUserEdit', [user.username])" class="material-symbols text-base">edit</button>
              </div>
              <div v-show="user.type !== 'root' && user.id !== currentUserId" class="h-8 w-8 flex items-center justify-center text-white text-opacity-50 hover:text-error cursor-pointer" @click.stop="deleteUserClick(user)">
                <button type="button" :aria-label="$getString('ButtonUserDelete', [user.username])" class="material-symbols text-base">delete</button>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      users: [],
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
    },
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    timeFormat() {
      return this.$store.state.serverSettings.timeFormat
    }
  },
  methods: {
    getDeviceInfoString(deviceInfo) {
      if (!deviceInfo) return ''
      if (deviceInfo.manufacturer && deviceInfo.model) return `${deviceInfo.manufacturer} ${deviceInfo.model}`

      return `${deviceInfo.osName || 'Unknown'} ${deviceInfo.osVersion || ''} ${deviceInfo.browserName || ''}`
    },
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
    editUser(user) {
      this.$emit('edit', user)
    },
    loadUsers() {
      this.$axios
        .$get('/api/users?include=latestSession')
        .then((res) => {
          this.users = res.users.sort((a, b) => {
            return a.createdAt - b.createdAt
          })
          this.$emit('numUsers', this.users.length)
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
