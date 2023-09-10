<template>
  <div class="w-full pl-2 pr-4 md:px-4 h-12 border border-white border-opacity-10 flex items-center relative -mt-px" :class="selected ? 'bg-primary bg-opacity-50' : 'hover:bg-primary hover:bg-opacity-25'" @mouseover="mouseover = true" @mouseleave="mouseover = false">
    <div v-show="selected" class="absolute top-0 left-0 h-full w-0.5 bg-warning z-10" />
    <ui-library-icon v-if="!libraryScan" :icon="library.icon" :size="6" font-size="lg md:text-xl" class="text-white" :class="isHovering ? 'text-opacity-90' : 'text-opacity-50'" />
    <svg v-else viewBox="0 0 24 24" class="h-6 w-6 text-white text-opacity-50 animate-spin">
      <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
    </svg>
    <p class="text-base md:text-xl pl-2 md:pl-4 hover:underline cursor-pointer" @click.stop="$emit('click', library)">{{ library.name }}</p>

    <div class="flex-grow" />

    <!-- Desktop context menu icon -->
    <ui-context-menu-dropdown v-if="!libraryScan && !isDeleting" :items="contextMenuItems" :icon-class="`text-1.5xl text-gray-${isHovering ? 50 : 400}`" class="!hidden md:!block" @action="contextMenuAction" />

    <!-- Mobile context menu icon -->
    <span v-if="!libraryScan && !isDeleting" class="!block md:!hidden material-icons text-xl text-gray-300 ml-3 cursor-pointer" @click.stop="showMenu">more_vert</span>

    <div v-show="isDeleting" class="text-xl text-gray-300 ml-3 animate-spin">
      <svg viewBox="0 0 24 24" class="w-6 h-6">
        <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
      </svg>
    </div>
    <span class="material-icons drag-handle text-xl text-gray-400 hover:text-gray-50 ml-2 md:ml-4">reorder</span>

    <!-- For mobile -->
    <modals-dialog v-model="showMobileMenu" :title="menuTitle" :items="contextMenuItems" @action="contextMenuAction" />
  </div>
</template>

<script>
export default {
  props: {
    library: {
      type: Object,
      default: () => {}
    },
    selected: Boolean,
    dragging: Boolean
  },
  data() {
    return {
      mouseover: false,
      isDeleting: false,
      showMobileMenu: false
    }
  },
  computed: {
    isHovering() {
      return this.mouseover && !this.dragging
    },
    libraryScan() {
      return this.$store.getters['scanners/getLibraryScan'](this.library.id)
    },
    mediaType() {
      return this.library.mediaType
    },
    isBookLibrary() {
      return this.mediaType === 'book'
    },
    menuTitle() {
      return this.library.name
    },
    contextMenuItems() {
      const items = [
        {
          text: this.$strings.ButtonEdit,
          action: 'edit',
          value: 'edit'
        },
        {
          text: this.$strings.ButtonScan,
          action: 'scan',
          value: 'scan'
        }
      ]
      if (this.isBookLibrary) {
        items.push({
          text: this.$strings.ButtonMatchBooks,
          action: 'match-books',
          value: 'match-books'
        })
      }
      items.push({
        text: this.$strings.ButtonDelete,
        action: 'delete',
        value: 'delete'
      })
      return items
    }
  },
  methods: {
    contextMenuAction({ action }) {
      this.showMobileMenu = false
      if (action === 'edit') {
        this.editClick()
      } else if (action === 'scan') {
        this.scan()
      } else if (action === 'force-scan') {
        this.forceScan()
      } else if (action === 'match-books') {
        this.matchAll()
      } else if (action === 'delete') {
        this.deleteClick()
      }
    },
    showMenu() {
      this.showMobileMenu = true
    },
    matchAll() {
      this.$axios
        .$get(`/api/libraries/${this.library.id}/matchall`)
        .then(() => {
          console.log('Starting scan for matches')
        })
        .catch((error) => {
          console.error('Failed', error)
          var errorMsg = err.response ? err.response.data : ''
          this.$toast.error(errorMsg || 'Match all failed')
        })
    },
    editClick() {
      this.$emit('edit', this.library)
    },
    scan() {
      this.$store
        .dispatch('libraries/requestLibraryScan', { libraryId: this.library.id })
        .then(() => {
          this.$toast.success(this.$strings.ToastLibraryScanStarted)
        })
        .catch((error) => {
          console.error('Failed to start scan', error)
          this.$toast.error(this.$strings.ToastLibraryScanFailedToStart)
        })
    },
    deleteClick() {
      const payload = {
        message: this.$getString('MessageConfirmDeleteLibrary', [this.library.name]),
        callback: (confirmed) => {
          if (confirmed) {
            this.isDeleting = true
            this.$axios
              .$delete(`/api/libraries/${this.library.id}`)
              .then((data) => {
                if (data.error) {
                  this.$toast.error(data.error)
                } else {
                  this.$toast.success(this.$strings.ToastLibraryDeleteSuccess)
                }
              })
              .catch((error) => {
                console.error('Failed to delete library', error)
                this.$toast.error(this.$strings.ToastLibraryDeleteFailed)
              })
              .finally(() => {
                this.isDeleting = false
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    }
  },
  mounted() {}
}
</script>