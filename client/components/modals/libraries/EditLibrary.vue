<template>
  <div class="w-full h-full md:px-4 py-2 mb-4">
    <div v-if="!showDirectoryPicker" class="w-full h-full md:py-4">
      <div class="flex flex-wrap md:flex-nowrap -mx-1 mb-2">
        <div class="w-2/5 md:w-72 px-1 py-1 md:py-0">
          <ui-dropdown v-model="mediaType" :items="mediaTypes" :label="$strings.LabelMediaType" :disabled="!isNew" small @input="changedMediaType" />
        </div>
        <div class="w-full md:grow px-1 py-1 md:py-0">
          <ui-text-input-with-label ref="nameInput" v-model="name" :label="$strings.LabelLibraryName" @blur="nameBlurred" />
        </div>
        <div class="w-1/5 md:w-18 px-1 py-1 md:py-0">
          <ui-media-icon-picker v-model="icon" :label="$strings.LabelIcon" @input="iconChanged" />
        </div>
        <div class="w-2/5 md:w-72 px-1 py-1 md:py-0">
          <ui-dropdown v-model="provider" :items="providers" :label="$strings.LabelMetadataProvider" small @input="formUpdated" />
        </div>
      </div>

      <div class="folders-container overflow-y-auto w-full py-2 mb-2">
        <p class="px-1 text-sm font-semibold">{{ $strings.LabelFolders }}</p>
        <div v-for="(folder, index) in folders" :key="index" class="w-full flex items-center py-1 px-2">
          <span class="material-symbols fill mr-2 text-yellow-200" style="font-size: 1.2rem">folder</span>
          <ui-editable-text ref="folderInput" v-model="folder.fullPath" :readonly="!!folder.id" type="text" class="w-full" @blur="existingFolderInputBlurred(folder)" />
          <span v-show="folders.length > 1" class="material-symbols text-2xl ml-2 cursor-pointer hover:text-error" @click="removeFolder(folder)">close</span>
        </div>
        <div class="flex py-1 px-2 items-center w-full">
          <span class="material-symbols fill mr-2 text-yellow-200" style="font-size: 1.2rem">folder</span>
          <ui-editable-text ref="newFolderInput" v-model="newFolderPath" :placeholder="$strings.PlaceholderNewFolderPath" type="text" class="w-full" @blur="newFolderInputBlurred" />
        </div>

        <ui-btn class="w-full mt-2" color="bg-primary" @click="browseForFolder">{{ $strings.ButtonBrowseForFolder }}</ui-btn>
      </div>
    </div>
    <modals-libraries-lazy-folder-chooser v-else :paths="folderPaths" @back="showDirectoryPicker = false" @select="selectFolder" />
  </div>
</template>

<script>
export default {
  props: {
    isNew: Boolean,
    library: {
      type: Object,
      default: () => null
    },
    processing: Boolean
  },
  data() {
    return {
      name: '',
      provider: 'google',
      icon: '',
      folders: [],
      showDirectoryPicker: false,
      newFolderPath: '',
      mediaType: null
    }
  },
  computed: {
    mediaTypes() {
      return [
        {
          value: 'book',
          text: this.$strings.LabelBooks
        },
        {
          value: 'podcast',
          text: this.$strings.LabelPodcasts
        }
      ]
    },
    folderPaths() {
      return this.folders.map((f) => f.fullPath)
    },
    providers() {
      if (this.mediaType === 'podcast') return this.$store.state.scanners.podcastProviders
      return this.$store.state.scanners.bookProviders
    }
  },
  methods: {
    checkBlurExpressionInput() {
      if (this.$refs.nameInput) {
        this.$refs.nameInput.blur()
      }
      if (this.$refs.folderInput && this.$refs.folderInput.length) {
        this.$refs.folderInput.forEach((input) => {
          if (input.blur) input.blur()
        })
      }
      if (this.$refs.newFolderInput) {
        this.$refs.newFolderInput.blur()
      }
    },
    browseForFolder() {
      this.showDirectoryPicker = true
    },
    getLibraryData() {
      return {
        name: this.name,
        provider: this.provider,
        folders: this.folders,
        icon: this.icon,
        mediaType: this.mediaType
      }
    },
    formUpdated() {
      this.$emit('update', this.getLibraryData())
    },
    existingFolderInputBlurred(folder) {
      if (!folder.fullPath) {
        this.removeFolder(folder)
      }
    },
    newFolderInputBlurred() {
      if (this.newFolderPath) {
        this.folders.push({ fullPath: this.newFolderPath })
        this.newFolderPath = ''
        this.formUpdated()
      }
    },
    iconChanged() {
      this.formUpdated()
    },
    nameBlurred() {
      if (this.name !== this.library.name) {
        this.formUpdated()
      }
    },
    changedMediaType() {
      this.provider = this.providers[0].value
      this.formUpdated()
    },
    selectFolder(fullPath) {
      this.folders.push({ fullPath })
      this.showDirectoryPicker = false
      this.formUpdated()
    },
    removeFolder(folder) {
      this.folders = this.folders.filter((f) => f.fullPath !== folder.fullPath)
      this.formUpdated()
    },
    backArrowPress() {
      if (this.showDirectoryPicker) {
        this.showDirectoryPicker = false
      }
    },
    init() {
      this.name = this.library ? this.library.name : ''
      this.provider = this.library ? this.library.provider : 'google'
      this.folders = this.library ? this.library.folders.map((p) => ({ ...p })) : []
      this.icon = this.library ? this.library.icon : 'default'
      this.mediaType = this.library ? this.library.mediaType : 'book'

      this.showDirectoryPicker = false
    }
  },
  mounted() {
    this.init()
    // Fetch providers if not already loaded
    this.$store.dispatch('scanners/fetchProviders')
  }
}
</script>

<style>
.folders-container {
  max-height: calc(80vh - 192px);
}
@media (max-device-width: 768px) {
  .folders-container {
    max-height: calc(80vh - 292px);
  }
}
</style>
