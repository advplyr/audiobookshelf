<template>
  <div v-if="currentLibrary" class="relative sm:w-36 h-8" v-click-outside="clickOutsideObj">
    <button type="button" :disabled="disabled" class="w-14 sm:w-36 ml-1 mr-1 relative h-full border border-white border-opacity-10 hover:border-opacity-20 rounded shadow-sm pl-3 pr-3 text-left focus:outline-none cursor-pointer bg-black bg-opacity-20 text-gray-400 hover:text-gray-200" aria-haspopup="listbox" aria-expanded="true" @click.stop.prevent="clickShowMenu">
      <span class="flex items-center justify-center">
        <widgets-library-icon :icon="currentLibraryIcon" class="sm:mr-2" />
        <span class="hidden sm:block">{{ currentLibrary.name }}</span>
      </span>
    </button>

    <transition name="menu">
      <ul v-show="showMenu" class="absolute z-10 -mt-px w-36 bg-primary border border-black-200 shadow-lg max-h-56 rounded-b-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" tabindex="-1" role="listbox">
        <template v-for="library in librariesFiltered">
          <li :key="library.id" class="text-gray-100 select-none relative py-2 cursor-pointer hover:bg-black-400" id="listbox-option-0" role="option" @click="selectLibrary(library)">
            <div class="flex items-center px-3">
              <widgets-library-icon :icon="library.icon" class="mr-2" />
              <span class="font-normal block truncate font-sans text-sm">{{ library.name }}</span>
            </div>
          </li>
        </template>
      </ul>
    </transition>
  </div>
</template>

<script>
export default {
  data() {
    return {
      clickOutsideObj: {
        handler: this.clickedOutside,
        events: ['mousedown'],
        isActive: true
      },
      showMenu: false,
      disabled: false
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    currentLibrary() {
      return this.libraries.find((lib) => lib.id === this.currentLibraryId)
    },
    currentLibraryIcon() {
      return this.currentLibrary ? this.currentLibrary.icon || 'database' : 'database'
    },
    libraries() {
      return this.$store.getters['libraries/getSortedLibraries']()
    },
    canUserAccessAllLibraries() {
      return this.$store.getters['user/getUserCanAccessAllLibraries']
    },
    userLibrariesAccessible() {
      return this.$store.getters['user/getLibrariesAccessible']
    },
    librariesFiltered() {
      if (this.canUserAccessAllLibraries) return this.libraries
      return this.libraries.filter((lib) => {
        return this.userLibrariesAccessible.includes(lib.id)
      })
    }
  },
  methods: {
    clickShowMenu() {
      if (this.disabled) return
      this.showMenu = !this.showMenu
    },
    clickedOutside() {
      this.showMenu = false
    },
    selectLibrary(library) {
      this.updateLibrary(library)
      this.showMenu = false
    },
    async updateLibrary(library) {
      var currLibraryId = this.currentLibraryId

      this.disabled = true
      await this.$store.dispatch('libraries/fetch', library.id)

      if (this.$route.name.startsWith('config')) {
        // No need to refresh
      } else if (this.$route.name.startsWith('library')) {
        var newRoute = this.$route.path.replace(currLibraryId, library.id)
        this.$router.push(newRoute)
      } else {
        this.$router.push(`/library/${library.id}`)
      }

      this.disabled = false
    }
  },
  mounted() {}
}
</script>