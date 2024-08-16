<template>
  <tr>
    <td class="px-4">
      {{ showFullPath ? file.metadata.path : file.metadata.relPath }} <ui-tooltip :text="$strings.LabelPrimaryEbook" class="inline-block"><span v-if="isPrimary" class="material-symbols text-success align-text-bottom">check_circle</span></ui-tooltip>
    </td>
    <td>
      {{ $bytesPretty(file.metadata.size) }}
    </td>
    <td class="text-xs">
      <ui-icon-btn icon="auto_stories" outlined borderless icon-font-size="1.125rem" :size="8" @click="readEbook" />
    </td>
    <td v-if="contextMenuItems.length" class="text-center">
      <ui-context-menu-dropdown :items="contextMenuItems" :menu-width="130" :processing="processing" @action="contextMenuAction" />
    </td>
  </tr>
</template>

<script>
export default {
  props: {
    libraryItemId: String,
    showFullPath: Boolean,
    file: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      processing: false
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userIsAdmin() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    downloadUrl() {
      return `${process.env.serverUrl}/api/items/${this.libraryItemId}/file/${this.file.ino}/download?token=${this.userToken}`
    },
    isPrimary() {
      return !this.file.isSupplementary
    },
    libraryIsAudiobooksOnly() {
      return this.$store.getters['libraries/getLibraryIsAudiobooksOnly']
    },
    contextMenuItems() {
      const items = []
      if (this.userCanUpdate && !this.libraryIsAudiobooksOnly) {
        items.push({
          text: this.isPrimary ? this.$strings.LabelSetEbookAsSupplementary : this.$strings.LabelSetEbookAsPrimary,
          action: 'updateStatus'
        })
      }
      if (this.userCanDownload) {
        items.push({
          text: this.$strings.LabelDownload,
          action: 'download'
        })
      }
      if (this.userCanDelete) {
        items.push({
          text: this.$strings.ButtonDelete,
          action: 'delete'
        })
      }
      return items
    }
  },
  methods: {
    readEbook() {
      this.$emit('read', this.file.ino)
    },
    contextMenuAction({ action }) {
      if (action === 'delete') {
        this.deleteLibraryFile()
      } else if (action === 'download') {
        this.downloadLibraryFile()
      } else if (action === 'updateStatus') {
        this.updateEbookStatus()
      }
    },
    updateEbookStatus() {
      this.processing = true
      this.$axios
        .$patch(`/api/items/${this.libraryItemId}/ebook/${this.file.ino}/status`)
        .then(() => {
          this.$toast.success('Ebook updated')
        })
        .catch((error) => {
          console.error('Failed to update ebook', error)
          this.$toast.error('Failed to update ebook')
        })
        .finally(() => {
          this.processing = false
        })
    },
    deleteLibraryFile() {
      const payload = {
        message: this.$strings.MessageConfirmDeleteFile,
        callback: (confirmed) => {
          if (confirmed) {
            this.processing = true
            this.$axios
              .$delete(`/api/items/${this.libraryItemId}/file/${this.file.ino}`)
              .then(() => {
                this.$toast.success(this.$strings.ToastDeleteFileSuccess)
              })
              .catch((error) => {
                console.error('Failed to delete file', error)
                this.$toast.error(this.$strings.ToastDeleteFileFailed)
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
    downloadLibraryFile() {
      this.$downloadFile(this.downloadUrl, this.file.metadata.filename)
    }
  },
  mounted() {}
}
</script>
