<template>
  <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8 relative" style="min-height: 200px">
    <div class="flex items-center mb-4">
      <nuxt-link to="/config/item-metadata-utils" class="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center">
        <span class="material-symbols text-2xl">arrow_back</span>
      </nuxt-link>

      <h1 class="text-xl mx-2">{{ $strings.HeaderManageGenres }}</h1>
    </div>

    <p v-if="!genres.length && !loading" class="text-center py-8 text-lg">{{ $strings.MessageNoGenres }}</p>

    <div class="border border-white/10">
      <template v-for="(genre, index) in genres">
        <div :key="genre" class="w-full p-2 flex items-center text-gray-400 hover:text-white" :class="{ 'bg-primary/20': index % 2 === 0 }">
          <p v-if="editingGenre !== genre" class="text-sm md:text-base text-gray-100">{{ genre }}</p>
          <ui-text-input v-else v-model="newGenreName" />
          <div class="flex-grow" />
          <template v-if="editingGenre !== genre">
            <ui-icon-btn v-if="editingGenre !== genre" icon="edit" borderless :size="8" icon-font-size="1.1rem" class="mx-1" @click="editClick(genre)" />
            <ui-icon-btn v-if="editingGenre !== genre" icon="delete" borderless :size="8" icon-font-size="1.1rem" @click="removeClick(genre)" />
          </template>
          <template v-else>
            <ui-btn color="success" small class="mx-2" @click.stop="saveClick">{{ $strings.ButtonSave }}</ui-btn>
            <ui-btn small @click.stop="cancelEditClick">{{ $strings.ButtonCancel }}</ui-btn>
          </template>
        </div>
      </template>
    </div>

    <div v-if="loading" class="absolute top-0 left-0 w-full h-full bg-black/25 rounded-md">
      <div class="sticky top-0 left-0 w-full h-full flex items-center justify-center" style="max-height: 80vh">
        <ui-loading-indicator />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      loading: false,
      genres: [],
      editingGenre: null,
      newGenreName: ''
    }
  },
  watch: {},
  computed: {},
  methods: {
    cancelEditClick() {
      this.newGenreName = ''
      this.editingGenre = null
    },
    removeClick(genre) {
      const payload = {
        message: `Are you sure you want to remove genre "${genre}" from all items?`,
        callback: (confirmed) => {
          if (confirmed) {
            this.removeGenre(genre)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    editClick(genre) {
      this.newGenreName = genre
      this.editingGenre = genre
    },
    saveClick() {
      this.newGenreName = this.newGenreName.trim()
      if (!this.newGenreName) {
        return
      }

      if (this.editingGenre === this.newGenreName) {
        this.cancelEditClick()
        return
      }

      const genreNameExists = this.genres.find((g) => g !== this.editingGenre && g === this.newGenreName)
      const genreNameExistsOfDifferentCase = !genreNameExists ? this.genres.find((g) => g !== this.editingGenre && g.toLowerCase() === this.newGenreName.toLowerCase()) : null

      let message = this.$getString('MessageConfirmRenameGenre', [this.editingGenre, this.newGenreName])
      if (genreNameExists) {
        message += `<br><span class="text-sm">${this.$strings.MessageConfirmRenameGenreMergeNote}</span>`
      } else if (genreNameExistsOfDifferentCase) {
        message += `<br><span class="text-warning text-sm">${this.$getString('MessageConfirmRenameGenreWarning', [genreNameExistsOfDifferentCase])}</span>`
      }

      const payload = {
        message,
        callback: (confirmed) => {
          if (confirmed) {
            this.renameGenre()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    renameGenre() {
      this.loading = true
      let _newGenreName = this.newGenreName
      let _editingGenre = this.editingGenre

      const payload = {
        genre: _editingGenre,
        newGenre: _newGenreName
      }
      this.$axios
        .$post('/api/genres/rename', payload)
        .then((res) => {
          this.$toast.success(this.$getString('MessageItemsUpdated', [res.numItemsUpdated]))
          if (res.genreMerged) {
            this.genres = this.genres.filter((g) => g !== _newGenreName)
          }
          this.genres = this.genres.map((g) => {
            if (g === _editingGenre) return _newGenreName
            return g
          })
          this.cancelEditClick()
        })
        .catch((error) => {
          console.error('Failed to rename genre', error)
          this.$toast.error(this.$strings.ToastRenameFailed)
        })
        .finally(() => {
          this.loading = false
        })
    },
    removeGenre(genre) {
      this.loading = true

      this.$axios
        .$delete(`/api/genres/${this.$encode(genre)}`)
        .then((res) => {
          this.$toast.success(this.$getString('MessageItemsUpdated', [res.numItemsUpdated]))
          this.genres = this.genres.filter((g) => g !== genre)
        })
        .catch((error) => {
          console.error('Failed to remove genre', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.loading = false
        })
    },
    init() {
      this.loading = true
      this.$axios
        .$get('/api/genres')
        .then((data) => {
          this.genres = (data.genres || []).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        })
        .catch((error) => {
          console.error('Failed to load genres', error)
        })
        .finally(() => {
          this.loading = false
        })
    }
  },
  mounted() {
    this.init()
  },
  beforeDestroy() {}
}
</script>
