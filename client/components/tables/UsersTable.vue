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
  computed: {},
  methods: {
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