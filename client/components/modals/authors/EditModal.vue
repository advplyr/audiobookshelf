<template>
  <modals-modal v-model="show" name="edit-author" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div v-if="author" class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <div class="flex">
        <div class="w-40 p-2">
          <div class="w-full h-45 relative">
            <covers-author-image :author="authorCopy" />
            <div v-if="userCanDelete && !processing && author.imagePath" class="absolute top-0 left-0 w-full h-full opacity-0 hover:opacity-100">
              <span class="absolute top-2 right-2 material-symbols text-error transform hover:scale-125 transition-transform cursor-pointer text-lg" @click="removeCover">delete</span>
            </div>
          </div>
        </div>
        <div class="grow">
          <form @submit.prevent="submitUploadCover" class="flex grow mb-2 p-2">
            <ui-text-input v-model="imageUrl" :placeholder="$strings.LabelImageURLFromTheWeb" class="h-9 w-full" />
            <ui-btn color="bg-success" type="submit" :padding-x="4" :disabled="!imageUrl" class="ml-2 sm:ml-3 w-24 h-9">{{ $strings.ButtonSubmit }}</ui-btn>
          </form>

          <form v-if="author" @submit.prevent="submitForm">
            <div class="flex">
              <div class="w-3/4 p-2">
                <ui-text-input-with-label v-model="authorCopy.name" :disabled="processing" :label="$strings.LabelName" />
              </div>
              <div class="grow p-2">
                <ui-text-input-with-label v-model="authorCopy.asin" :disabled="processing" label="ASIN" />
              </div>
            </div>
            <div class="p-2">
              <ui-textarea-with-label v-model="authorCopy.description" :disabled="processing" :label="$strings.LabelDescription" :rows="8" />
            </div>

            <div class="flex pt-2 px-2">
              <ui-btn v-if="userCanDelete" small color="bg-error" type="button" @click.stop="removeClick">{{ $strings.ButtonRemove }}</ui-btn>
              <div class="grow" />
              <ui-btn type="button" class="mx-2" @click="searchAuthor">{{ $strings.ButtonQuickMatch }}</ui-btn>

              <ui-btn type="submit">{{ $strings.ButtonSave }}</ui-btn>
            </div>
          </form>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      authorCopy: {
        name: '',
        asin: '',
        description: ''
      },
      imageUrl: '',
      processing: false
    }
  },
  watch: {
    author: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showEditAuthorModal
      },
      set(val) {
        this.$store.commit('globals/setShowEditAuthorModal', val)
      }
    },
    author() {
      return this.$store.state.globals.selectedAuthor
    },
    authorId() {
      if (!this.author) return ''
      return this.author.id
    },
    title() {
      return this.$strings.HeaderUpdateAuthor
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    libraryProvider() {
      return this.$store.getters['libraries/getLibraryProvider'](this.currentLibraryId) || 'google'
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    }
  },
  methods: {
    init() {
      this.imageUrl = ''
      this.authorCopy = {
        ...this.author
      }
    },
    removeClick() {
      const payload = {
        message: this.$getString('MessageConfirmRemoveAuthor', [this.author.name]),
        callback: (confirmed) => {
          if (confirmed) {
            this.processing = true
            this.$axios
              .$delete(`/api/authors/${this.authorId}`)
              .then(() => {
                this.$toast.success(this.$strings.ToastAuthorRemoveSuccess)
                this.show = false
              })
              .catch((error) => {
                console.error('Failed to remove author', error)
                this.$toast.error(this.$strings.ToastRemoveFailed)
              })
              .finally(() => {
                this.processing = false
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    async submitForm() {
      var keysToCheck = ['name', 'asin', 'description']
      var updatePayload = {}
      keysToCheck.forEach((key) => {
        if (this.authorCopy[key] !== this.author[key]) {
          updatePayload[key] = this.authorCopy[key]
        }
      })
      if (!Object.keys(updatePayload).length) {
        this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
        return
      }
      this.processing = true
      var result = await this.$axios.$patch(`/api/authors/${this.authorId}`, updatePayload).catch((error) => {
        console.error('Failed', error)
        const errorMsg = error.response ? error.response.data : null
        this.$toast.error(errorMsg || this.$strings.ToastFailedToUpdate)
        return null
      })
      if (result) {
        if (result.updated) {
          this.$toast.success(this.$strings.ToastAuthorUpdateSuccess)
          this.show = false
        } else if (result.merged) {
          this.$toast.success(this.$strings.ToastAuthorUpdateMerged)
          this.show = false
        } else this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
      }
      this.processing = false
    },
    removeCover() {
      this.processing = true
      this.$axios
        .$delete(`/api/authors/${this.authorId}/image`)
        .then((data) => {
          this.$toast.success(this.$strings.ToastAuthorImageRemoveSuccess)

          this.authorCopy.updatedAt = data.author.updatedAt
          this.authorCopy.imagePath = data.author.imagePath
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    submitUploadCover() {
      if (!this.imageUrl?.startsWith('http:') && !this.imageUrl?.startsWith('https:')) {
        this.$toast.error(this.$strings.ToastInvalidImageUrl)
        return
      }

      this.processing = true
      const updatePayload = {
        url: this.imageUrl
      }
      this.$axios
        .$post(`/api/authors/${this.authorId}/image`, updatePayload)
        .then((data) => {
          this.imageUrl = ''
          this.$toast.success(this.$strings.ToastAuthorUpdateSuccess)

          this.authorCopy.updatedAt = data.author.updatedAt
          this.authorCopy.imagePath = data.author.imagePath
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error(error.response.data || this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    async searchAuthor() {
      if (!this.authorCopy.name && !this.authorCopy.asin) {
        this.$toast.error(this.$strings.ToastNameRequired)
        return
      }
      this.processing = true

      const payload = {}
      if (this.authorCopy.asin) payload.asin = this.authorCopy.asin
      else payload.q = this.authorCopy.name

      payload.region = 'us'
      if (this.libraryProvider.startsWith('audible.')) {
        payload.region = this.libraryProvider.split('.').pop() || 'us'
      }

      var response = await this.$axios.$post(`/api/authors/${this.authorId}/match`, payload).catch((error) => {
        console.error('Failed', error)
        return null
      })
      if (!response) {
        this.$toast.error(this.$strings.ToastAuthorSearchNotFound)
      } else if (response.updated) {
        if (response.author.imagePath) {
          this.$toast.success(this.$strings.ToastAuthorUpdateSuccess)
        } else {
          this.$toast.success(this.$strings.ToastAuthorUpdateSuccessNoImageFound)
        }

        this.authorCopy = {
          ...response.author
        }
      } else {
        this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
      }
      this.processing = false
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
