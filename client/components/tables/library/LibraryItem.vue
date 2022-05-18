<template>
  <div class="w-full px-4 h-12 border border-white border-opacity-10 flex items-center relative -mt-px" :class="selected ? 'bg-primary bg-opacity-50' : 'hover:bg-primary hover:bg-opacity-25'" @mouseover="mouseover = true" @mouseleave="mouseover = false">
    <div v-show="selected" class="absolute top-0 left-0 h-full w-0.5 bg-warning z-10" />
    <widgets-library-icon v-if="!libraryScan" :icon="library.icon" :size="6" class="text-white" :class="isHovering ? 'text-opacity-90' : 'text-opacity-50'" />
    <svg v-else viewBox="0 0 24 24" class="h-6 w-6 text-white text-opacity-50 animate-spin">
      <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
    </svg>
    <p class="text-xl font-book pl-4 hover:underline cursor-pointer" @click.stop="$emit('click', library)">{{ library.name }}</p>
    <div class="flex-grow" />
    <ui-btn v-show="isHovering && !libraryScan" small color="success" @click.stop="scan">Scan</ui-btn>
    <ui-btn v-show="isHovering && !libraryScan" small color="bg" class="ml-2" @click.stop="forceScan">Force Re-Scan</ui-btn>

    <ui-btn v-show="isHovering && !libraryScan && isBookLibrary" small color="bg" class="ml-2" @click.stop="matchAll">Match Books</ui-btn>

    <span v-show="isHovering && !libraryScan && showEdit" class="material-icons text-xl text-gray-300 hover:text-gray-50 ml-4 cursor-pointer" @click.stop="editClick">edit</span>
    <span v-show="!libraryScan && isHovering && showEdit && !isDeleting" class="material-icons text-xl text-gray-300 ml-3" :class="isMain ? 'text-opacity-5 cursor-not-allowed' : 'hover:text-gray-50 cursor-pointer'" @click.stop="deleteClick">delete</span>
    <div v-show="isDeleting" class="text-xl text-gray-300 ml-3 animate-spin">
      <svg viewBox="0 0 24 24" class="w-6 h-6">
        <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
      </svg>
    </div>
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
    showEdit: Boolean,
    dragging: Boolean
  },
  data() {
    return {
      mouseover: false,
      isDeleting: false
    }
  },
  computed: {
    isHovering() {
      return this.mouseover && !this.dragging
    },
    isMain() {
      return this.library.id === 'main'
    },
    libraryScan() {
      return this.$store.getters['scanners/getLibraryScan'](this.library.id)
    },
    mediaType() {
      return this.library.mediaType
    },
    isBookLibrary() {
      return this.mediaType === 'book'
    }
  },
  methods: {
    matchAll() {
      this.$axios
        .$post(`/api/libraries/${this.library.id}/matchall`)
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
          this.$toast.success('Library scan started')
        })
        .catch((error) => {
          console.error('Failed to start scan', error)
          this.$toast.error('Failed to start scan')
        })
    },
    forceScan() {
      this.$store
        .dispatch('libraries/requestLibraryScan', { libraryId: this.library.id, force: 1 })
        .then(() => {
          this.$toast.success('Library scan started')
        })
        .catch((error) => {
          console.error('Failed to start scan', error)
          this.$toast.error('Failed to start scan')
        })
    },
    deleteClick() {
      if (this.isMain) return
      if (confirm(`Are you sure you want to permanently delete library "${this.library.name}"?`)) {
        this.isDeleting = true
        this.$axios
          .$delete(`/api/libraries/${this.library.id}`)
          .then((data) => {
            this.isDeleting = false
            if (data.error) {
              this.$toast.error(data.error)
            } else {
              this.$toast.success('Library deleted')
            }
          })
          .catch((error) => {
            console.error('Failed to delete library', error)
            this.$toast.error('Failed to delete library')
            this.isDeleting = false
          })
      }
    }
  },
  mounted() {}
}
</script>