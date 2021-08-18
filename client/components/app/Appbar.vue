<template>
  <div class="w-full h-16 bg-primary relative">
    <div id="appbar" class="absolute top-0 bottom-0 left-0 w-full h-full px-6 py-1 z-20">
      <div class="flex h-full items-center">
        <img v-if="!showBack" src="/LogoTransparent.png" class="w-12 h-12 mr-4" />
        <a v-if="showBack" @click="back" class="rounded-full h-12 w-12 flex items-center justify-center hover:bg-white hover:bg-opacity-10 mr-4 cursor-pointer">
          <span class="material-icons text-4xl text-white">arrow_back</span>
        </a>
        <h1 class="text-2xl font-book">AudioBookshelf</h1>

        <div class="flex-grow" />

        <!-- <button class="px-4 py-2 bg-blue-500 rounded-xs" @click="scan">Scan</button> -->
        <nuxt-link to="/config" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center">
          <span class="material-icons">settings</span>
        </nuxt-link>

        <ui-menu :label="username" :items="menuItems" @action="menuAction" class="ml-5" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      menuItems: [
        // {
        //   value: 'settings',
        //   text: 'Settings'
        // },
        {
          value: 'logout',
          text: 'Logout'
        }
      ]
    }
  },
  computed: {
    showBack() {
      return this.$route.name !== 'index'
    },
    user() {
      return this.$store.state.user
    },
    username() {
      return this.user ? this.user.username : 'err'
    }
  },
  methods: {
    back() {
      if (this.$route.name === 'audiobook-id-edit') {
        this.$router.push(`/audiobook/${this.$route.params.id}`)
      } else {
        this.$router.push('/')
      }
    },
    scan() {
      console.log('Call Start Init')
      this.$root.socket.emit('scan')
    },
    logout() {
      this.$axios.$post('/logout').catch((error) => {
        console.error(error)
      })
      if (localStorage.getItem('token')) {
        localStorage.removeItem('token')
      }
      this.$router.push('/login')
    },
    menuAction(action) {
      if (action === 'logout') {
        this.logout()
      } else if (action === 'settings') {
        // Show settings modal
      }
    }
  },
  mounted() {}
}
</script>

<style>
#appbar {
  /* box-shadow: 0px 8px 8px #111111aa; */
  box-shadow: 0px 5px 5px #11111155;
}
</style>