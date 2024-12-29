<template>
  <div class="page relative" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar page="narrators" is-home />
    <div id="bookshelf" class="w-full h-full px-1 py-4 md:p-8 relative overflow-y-auto">
      <table class="tracksTable max-w-2xl mx-auto">
        <tr>
          <th class="text-left">{{ $strings.LabelName }}</th>
          <th class="text-center w-24">{{ $strings.LabelBooks }}</th>
          <th v-if="userCanUpdate" class="w-40"></th>
        </tr>
        <tr v-for="narrator in narrators" :key="narrator.id">
          <td>
            <p v-if="selectedNarrator?.id !== narrator.id" class="text-sm md:text-base text-gray-100">{{ narrator.name }}</p>
            <form v-else @submit.prevent="saveClick">
              <ui-text-input v-model="newNarratorName" />
            </form>
          </td>
          <td class="text-center w-24">
            <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=narrators.${narrator.id}`" class="hover:underline">{{ narrator.numBooks }}</nuxt-link>
          </td>
          <td v-if="userCanUpdate" class="w-40">
            <div class="flex justify-end items-center h-10">
              <template v-if="selectedNarrator?.id !== narrator.id">
                <ui-icon-btn icon="edit" borderless :size="8" icon-font-size="1.1rem" class="mx-1" @click="editClick(narrator)" />
                <ui-icon-btn icon="delete" borderless :size="8" icon-font-size="1.1rem" @click="removeClick(narrator)" />
              </template>
              <template v-else>
                <ui-btn color="success" small class="mr-2" @click.stop="saveClick">{{ $strings.ButtonSave }}</ui-btn>
                <ui-btn small @click.stop="cancelEditClick">{{ $strings.ButtonCancel }}</ui-btn>
              </template>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div v-if="loading" class="absolute top-0 left-0 w-full h-[calc(100%-40px)] mt-10 flex items-center justify-center bg-black/25">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    const libraryId = params.library
    const libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    const library = libraryData.library
    if (library.mediaType === 'podcast') {
      return redirect(`/library/${libraryId}`)
    }

    return {
      libraryId
    }
  },
  data() {
    return {
      loading: true,
      narrators: [],
      selectedNarrator: null,
      newNarratorName: null
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    }
  },
  methods: {
    removeClick(narrator) {
      const payload = {
        message: this.$getString('MessageConfirmRemoveNarrator', [narrator.name]),
        callback: (confirmed) => {
          if (confirmed) {
            this.removeNarrator(narrator.id)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    editClick(narrator) {
      this.selectedNarrator = narrator
      this.newNarratorName = narrator.name
    },
    cancelEditClick() {
      this.selectedNarrator = null
      this.newNarratorName = null
    },
    saveClick() {
      if (!this.selectedNarrator) return
      this.newNarratorName = this.newNarratorName?.trim() || ''
      if (!this.newNarratorName || this.newNarratorName === this.selectedNarrator.name) {
        this.cancelEditClick()
        return
      }

      this.loading = true
      this.$axios
        .$patch(`/api/libraries/${this.currentLibraryId}/narrators/${this.selectedNarrator.id}`, { name: this.newNarratorName })
        .then((data) => {
          if (data.updated) {
            this.$toast.success(this.$getString('MessageItemsUpdated', [data.updated]))
          } else {
            this.$toast.info(this.$strings.MessageNoUpdatesWereNecessary)
          }
          this.cancelEditClick()
          this.init()
        })
        .catch((error) => {
          console.error('Failed to updated narrator', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
          this.loading = false
        })
    },
    removeNarrator(id) {
      this.loading = true
      this.$axios
        .$delete(`/api/libraries/${this.currentLibraryId}/narrators/${id}`)
        .then((data) => {
          if (data.updated) {
            this.$toast.success(this.$getString('MessageItemsUpdated', [data.updated]))
          } else {
            this.$toast.info(this.$strings.MessageNoUpdatesWereNecessary)
          }
          this.init()
        })
        .catch((error) => {
          console.error('Failed to remove narrator', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
          this.loading = false
        })
    },
    async init() {
      this.narrators = await this.$axios
        .$get(`/api/libraries/${this.currentLibraryId}/narrators`)
        .then((response) => response.narrators)
        .catch((error) => {
          console.error('Failed to load narrators', error)
          return []
        })
      this.loading = false
    }
  },
  mounted() {
    this.init()
  },
  beforeDestroy() {}
}
</script>
