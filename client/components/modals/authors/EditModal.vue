<template>
  <modals-modal v-model="show" name="edit-author" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <form v-if="author" @submit.prevent="submitForm">
        <div class="flex">
          <div class="w-40 p-2">
            <div class="w-full h-45 relative">
              <covers-author-image :author="author" />
              <div v-show="!processing && author.imagePath" class="absolute top-0 left-0 w-full h-full opacity-0 hover:opacity-100">
                <span class="absolute top-2 right-2 material-icons text-error transform hover:scale-125 transition-transform cursor-pointer text-lg" @click="removeCover">delete</span>
              </div>
            </div>
          </div>
          <div class="flex-grow">
            <div class="flex">
              <div class="w-3/4 p-2">
                <ui-text-input-with-label v-model="authorCopy.name" :disabled="processing" label="Name" />
              </div>
              <div class="flex-grow p-2">
                <ui-text-input-with-label v-model="authorCopy.asin" :disabled="processing" label="ASIN" />
              </div>
            </div>
            <div class="p-2">
              <ui-text-input-with-label v-model="authorCopy.imagePath" :disabled="processing" label="Photo Path/URL" />
            </div>
            <div class="p-2">
              <ui-textarea-with-label v-model="authorCopy.description" :disabled="processing" label="Description" :rows="8" />
            </div>

            <div class="flex pt-2 px-2">
              <ui-btn type="button" @click="searchAuthor">Quick Match</ui-btn>
              <div class="flex-grow" />
              <ui-btn type="submit">Submit</ui-btn>
            </div>
          </div>
        </div>
      </form>
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
        description: '',
        imagePath: ''
      },
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
      return 'Edit Author'
    }
  },
  methods: {
    init() {
      this.authorCopy.name = this.author.name
      this.authorCopy.asin = this.author.asin
      this.authorCopy.description = this.author.description
      this.authorCopy.imagePath = this.author.imagePath
    },
    async submitForm() {
      var keysToCheck = ['name', 'asin', 'description', 'imagePath']
      var updatePayload = {}
      keysToCheck.forEach((key) => {
        if (this.authorCopy[key] !== this.author[key]) {
          updatePayload[key] = this.authorCopy[key]
        }
      })
      if (!Object.keys(updatePayload).length) {
        this.$toast.info('No updates are necessary')
        return
      }
      this.processing = true
      var result = await this.$axios.$patch(`/api/authors/${this.authorId}`, updatePayload).catch((error) => {
        console.error('Failed', error)
        this.$toast.error('Failed to update author')
        return null
      })
      if (result) {
        if (result.updated) {
          this.$toast.success('Author updated')
          this.show = false
        } else this.$toast.info('No updates were needed')
      }
      this.processing = false
    },
    async removeCover() {
      var updatePayload = {
        imagePath: null,
        relImagePath: null
      }
      this.processing = true
      var result = await this.$axios.$patch(`/api/authors/${this.authorId}`, updatePayload).catch((error) => {
        console.error('Failed', error)
        this.$toast.error('Failed to remove image')
        return null
      })
      if (result && result.updated) {
        this.$toast.success('Author image removed')
      }
      this.processing = false
    },
    async searchAuthor() {
      if (!this.authorCopy.name && !this.authorCopy.asin) {
        this.$toast.error('Must enter an author name')
        return
      }
      this.processing = true

      const payload = {}
      if (this.authorCopy.asin) payload.asin = this.authorCopy.asin
      else payload.q = this.authorCopy.name

      var response = await this.$axios.$post(`/api/authors/${this.authorId}/match`, payload).catch((error) => {
        console.error('Failed', error)
        return null
      })
      if (!response) {
        this.$toast.error('Author not found')
      } else if (response.updated) {
        if (response.author.imagePath) this.$toast.success('Author was updated')
        else this.$toast.success('Author was updated (no image found)')
      } else {
        this.$toast.info('No updates were made for Author')
      }
      this.processing = false
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>