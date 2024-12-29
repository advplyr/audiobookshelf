<template>
  <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8 relative" style="min-height: 200px">
    <div class="flex items-center mb-4">
      <nuxt-link to="/config/item-metadata-utils" class="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center">
        <span class="material-symbols text-2xl">arrow_back</span>
      </nuxt-link>

      <h1 class="text-xl mx-2">{{ $strings.HeaderManageTags }}</h1>
    </div>

    <p v-if="!tags.length && !loading" class="text-center py-8 text-lg">{{ $strings.MessageNoTags }}</p>

    <div class="border border-white/10">
      <template v-for="(tag, index) in tags">
        <div :key="tag" class="w-full p-2 flex items-center text-gray-400 hover:text-white" :class="{ 'bg-primary/20': index % 2 === 0 }">
          <p v-if="editingTag !== tag" class="text-sm md:text-base text-gray-100">{{ tag }}</p>
          <ui-text-input v-else v-model="newTagName" />
          <div class="flex-grow" />
          <template v-if="editingTag !== tag">
            <ui-icon-btn icon="edit" borderless :size="8" icon-font-size="1.1rem" class="mx-1" @click="editTagClick(tag)" />
            <ui-icon-btn icon="delete" borderless :size="8" icon-font-size="1.1rem" @click="removeTagClick(tag)" />
          </template>
          <template v-else>
            <ui-btn color="success" small class="mx-2" @click.stop="saveTagClick">{{ $strings.ButtonSave }}</ui-btn>
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
      tags: [],
      editingTag: null,
      newTagName: ''
    }
  },
  watch: {},
  computed: {},
  methods: {
    cancelEditClick() {
      this.newTagName = ''
      this.editingTag = null
    },
    removeTagClick(tag) {
      const payload = {
        message: `Are you sure you want to remove tag "${tag}" from all items?`,
        callback: (confirmed) => {
          if (confirmed) {
            this.removeTag(tag)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    saveTagClick() {
      this.newTagName = this.newTagName.trim()
      if (!this.newTagName) {
        return
      }

      if (this.editingTag === this.newTagName) {
        this.cancelEditClick()
        return
      }

      const tagNameExists = this.tags.find((t) => t !== this.editingTag && t === this.newTagName)
      const tagNameExistsOfDifferentCase = !tagNameExists ? this.tags.find((t) => t !== this.editingTag && t.toLowerCase() === this.newTagName.toLowerCase()) : null

      let message = this.$getString('MessageConfirmRenameTag', [this.editingTag, this.newTagName])
      if (tagNameExists) {
        message += `<br><span class="text-sm">${this.$strings.MessageConfirmRenameTagMergeNote}</span>`
      } else if (tagNameExistsOfDifferentCase) {
        message += `<br><span class="text-warning text-sm">${this.$getString('MessageConfirmRenameTagWarning', [tagNameExistsOfDifferentCase])}</span>`
      }

      const payload = {
        message,
        callback: (confirmed) => {
          if (confirmed) {
            this.renameTag()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    renameTag() {
      this.loading = true
      let _newTagName = this.newTagName
      let _editingTag = this.editingTag

      const payload = {
        tag: _editingTag,
        newTag: _newTagName
      }
      this.$axios
        .$post('/api/tags/rename', payload)
        .then((res) => {
          this.$toast.success(this.$getString('MessageItemsUpdated', [res.numItemsUpdated]))
          if (res.tagMerged) {
            this.tags = this.tags.filter((t) => t !== _newTagName)
          }
          this.tags = this.tags.map((t) => {
            if (t === _editingTag) return _newTagName
            return t
          })
          this.cancelEditClick()
        })
        .catch((error) => {
          console.error('Failed to rename tag', error)
          this.$toast.error(this.$strings.ToastRenameFailed)
        })
        .finally(() => {
          this.loading = false
        })
    },
    removeTag(tag) {
      this.loading = true

      this.$axios
        .$delete(`/api/tags/${this.$encode(tag)}`)
        .then((res) => {
          this.$toast.success(this.$getString('MessageItemsUpdated', [res.numItemsUpdated]))
          this.tags = this.tags.filter((t) => t !== tag)
        })
        .catch((error) => {
          console.error('Failed to remove tag', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.loading = false
        })
    },
    editTagClick(tag) {
      this.newTagName = tag
      this.editingTag = tag
    },
    init() {
      this.loading = true
      this.$axios
        .$get('/api/tags')
        .then((data) => {
          this.tags = (data.tags || []).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        })
        .catch((error) => {
          console.error('Failed to load tags', error)
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
