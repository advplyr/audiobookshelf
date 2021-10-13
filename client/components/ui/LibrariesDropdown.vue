<template>
  <div v-if="currentLibrary" class="relative w-36 h-8" v-click-outside="clickOutside">
    <button type="button" :disabled="disabled" class="relative h-full w-full border border-white border-opacity-10 hover:border-opacity-20 rounded shadow-sm pl-3 pr-10 text-left focus:outline-none cursor-pointer bg-black bg-opacity-20 text-gray-400 hover:text-gray-200" aria-haspopup="listbox" aria-expanded="true" @click.stop.prevent="clickShowMenu">
      <span class="flex items-center">
        <widgets-library-icon :icon="currentLibraryIcon" class="mr-2" />
        <span class="block truncate text-sm">{{ currentLibrary.name }}</span>
      </span>
    </button>

    <transition name="menu">
      <ul v-show="showMenu" class="absolute z-10 -mt-px w-full bg-primary border border-black-200 shadow-lg max-h-56 rounded-b-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" tabindex="-1" role="listbox">
        <template v-for="library in libraries">
          <li :key="library.id" class="text-gray-100 select-none relative py-2 cursor-pointer hover:bg-black-400" id="listbox-option-0" role="option" @click="selectLibrary(library)">
            <div class="flex items-center px-3">
              <widgets-library-icon :icon="currentLibraryIcon" class="mr-2" />
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
    libraryItems() {
      return this.libraries.map((lib) => ({ value: lib.id, text: lib.name }))
    }
  },
  methods: {
    clickShowMenu() {
      if (this.disabled) return
      this.showMenu = !this.showMenu
    },
    clickOutside() {
      this.showMenu = false
    },
    selectLibrary(library) {
      this.updateLibrary(library)
      this.showMenu = false
    },
    async updateLibrary(library) {
      this.disabled = true
      await this.$store.dispatch('libraries/fetch', library.id)
      this.$router.push(`/library/${library.id}`)
      this.disabled = false
    }
  },
  mounted() {}
}
</script>