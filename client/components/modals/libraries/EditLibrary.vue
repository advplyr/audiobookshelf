<template>
  <div class="w-full h-full px-4 py-2 mb-12">
    <div class="flex items-center py-1 mb-2">
      <span v-show="showDirectoryPicker" class="material-icons text-3xl cursor-pointer hover:text-gray-300" @click="backArrowPress">arrow_back</span>
      <p class="px-4 text-xl">{{ title }}</p>
    </div>

    <div v-if="!showDirectoryPicker" class="w-full h-full py-4">
      <ui-text-input-with-label v-model="name" label="Library Name" />

      <div class="w-full py-4">
        <p class="px-1 text-sm font-semibold">Folders</p>
        <div v-for="(folder, index) in folders" :key="index" class="w-full flex items-center py-1 px-2">
          <!-- <ui-text-input :value="folder.fullPath" type="text" class="w-full" /> -->
          <span class="material-icons bg-opacity-50 mr-2 text-yellow-200" style="font-size: 1.2rem">folder</span>
          <ui-editable-text v-model="folder.fullPath" type="text" class="w-full" />
          <span v-show="folders.length > 1" class="material-icons ml-2 cursor-pointer hover:text-error" @click="removeFolder(folder)">close</span>
        </div>
        <p v-if="!folders.length" class="text-sm text-gray-300 px-1 py-2">No folders</p>
        <ui-btn class="w-full mt-2" color="primary" @click="showDirectoryPicker = true">Browse for Folder</ui-btn>
      </div>
      <div class="absolute bottom-0 left-0 w-full py-4 px-4">
        <div class="flex items-center">
          <div class="flex-grow" />
          <ui-btn v-show="!disableSubmit" color="success" :disabled="disableSubmit" @click="submit">{{ library ? 'Update Library' : 'Create Library' }}</ui-btn>
        </div>
      </div>
    </div>
    <modals-libraries-folder-chooser v-else :paths="folderPaths" @select="selectFolder" />
  </div>
</template>

<script>
export default {
  props: {
    library: {
      type: Object,
      default: () => null
    },
    processing: Boolean
  },
  data() {
    return {
      name: '',
      folders: [],
      showDirectoryPicker: false
    }
  },
  computed: {
    title() {
      if (this.showDirectoryPicker) return 'Choose a Folder'
      return ''
    },
    folderPaths() {
      return this.folders.map((f) => f.fullPath)
    },
    disableSubmit() {
      if (!this.library) {
        return false
      }
      var newfolderpaths = this.folderPaths.join(',')
      var origfolderpaths = this.library.folders.map((f) => f.fullPath).join(',')

      return newfolderpaths === origfolderpaths && this.name === this.library.name
    }
  },
  methods: {
    removeFolder(folder) {
      this.folders = this.folders.filter((f) => f.fullPath !== folder.fullPath)
    },
    backArrowPress() {
      if (this.showDirectoryPicker) {
        this.showDirectoryPicker = false
      }
    },
    init() {
      this.name = this.library ? this.library.name : ''
      this.folders = this.library ? this.library.folders.map((p) => ({ ...p })) : []
      this.showDirectoryPicker = false
    },
    selectFolder(fullPath) {
      this.folders.push({ fullPath })
      this.showDirectoryPicker = false
    },
    submit() {
      if (this.library) {
        this.updateLibrary()
      } else {
        this.createLibrary()
      }
    },
    updateLibrary() {
      if (!this.name) {
        this.$toast.error('Library must have a name')
        return
      }
      if (!this.folders.length) {
        this.$toast.error('Library must have at least 1 path')
        return
      }
      var newLibraryPayload = {
        name: this.name,
        folders: this.folders
      }

      this.$emit('update:processing', true)
      this.$axios
        .$patch(`/api/library/${this.library.id}`, newLibraryPayload)
        .then((res) => {
          this.$emit('update:processing', false)
          this.$emit('close')
          this.$toast.success(`Library "${res.name}" updated successfully`)
        })
        .catch((error) => {
          console.error(error)
          if (error.response && error.response.data) {
            this.$toast.error(error.response.data)
          } else {
            this.$toast.error('Failed to update library')
          }
          this.$emit('update:processing', false)
        })
    },
    createLibrary() {
      if (!this.name) {
        this.$toast.error('Library must have a name')
        return
      }
      if (!this.folders.length) {
        this.$toast.error('Library must have at least 1 path')
        return
      }
      var newLibraryPayload = {
        name: this.name,
        folders: this.folders
      }

      this.$emit('update:processing', true)
      this.$axios
        .$post('/api/library', newLibraryPayload)
        .then((res) => {
          this.$emit('update:processing', false)
          this.$emit('close')
          this.$toast.success(`Library "${res.name}" created successfully`)
        })
        .catch((error) => {
          console.error(error)
          if (error.response && error.response.data) {
            this.$toast.error(error.response.data)
          } else {
            this.$toast.error('Failed to create library')
          }
          this.$emit('update:processing', false)
        })
    }
  },
  mounted() {
    this.init()
  }
}
</script>
