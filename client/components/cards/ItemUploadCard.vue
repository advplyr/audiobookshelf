<template>
  <div class="relative w-full py-4 px-6 border border-white border-opacity-10 shadow-lg rounded-md my-6">
    <div class="absolute -top-3 -left-3 w-8 h-8 bg-bg border border-white border-opacity-10 flex items-center justify-center rounded-full">
      <p class="text-base text-white text-opacity-80 font-mono">#{{ item.index }}</p>
    </div>

    <div v-if="!processing && !uploadFailed && !uploadSuccess" class="absolute -top-3 -right-3 w-8 h-8 bg-bg border border-white border-opacity-10 flex items-center justify-center rounded-full hover:bg-error cursor-pointer" @click="$emit('remove')">
      <span class="text-base text-white text-opacity-80 font-mono material-icons">close</span>
    </div>

    <template v-if="!uploadSuccess && !uploadFailed">
      <widgets-alert v-if="error" type="error">
        <p class="text-base">{{ error }}</p>
      </widgets-alert>

      <div class="flex my-2 -mx-2">
        <div class="w-1/2 px-2">
          <ui-text-input-with-label v-model="itemData.title" :disabled="processing" label="Title" @input="titleUpdated" />
        </div>
        <div class="w-1/2 px-2">
          <ui-text-input-with-label v-if="!isPodcast" v-model="itemData.author" :disabled="processing" label="Author" />
          <div v-else class="w-full">
            <p class="px-1 text-sm font-semibold">Directory <em class="font-normal text-xs pl-2">(auto)</em></p>
            <ui-text-input :value="directory" disabled class="w-full font-mono text-xs" style="height: 38px" />
          </div>
        </div>
      </div>
      <div v-if="!isPodcast" class="flex my-2 -mx-2">
        <div class="w-1/2 px-2">
          <ui-text-input-with-label v-model="itemData.series" :disabled="processing" label="Series" note="(optional)" />
        </div>
        <div class="w-1/2 px-2">
          <div class="w-full">
            <p class="px-1 text-sm font-semibold">Directory <em class="font-normal text-xs pl-2">(auto)</em></p>
            <ui-text-input :value="directory" disabled class="w-full font-mono text-xs" style="height: 38px" />
          </div>
        </div>
      </div>

      <tables-uploaded-files-table :files="item.itemFiles" title="Item Files" class="mt-8" />
      <tables-uploaded-files-table v-if="item.otherFiles.length" title="Other Files" :files="item.otherFiles" />
      <tables-uploaded-files-table v-if="item.ignoredFiles.length" title="Ignored Files" :files="item.ignoredFiles" />
    </template>
    <widgets-alert v-if="uploadSuccess" type="success">
      <p class="text-base">Successfully Uploaded!</p>
    </widgets-alert>
    <widgets-alert v-if="uploadFailed" type="error">
      <p class="text-base">Failed to upload</p>
    </widgets-alert>

    <div v-if="isUploading" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-20">
      <ui-loading-indicator text="Uploading..." />
    </div>
  </div>
</template>

<script>
import Path from 'path'

export default {
  props: {
    item: {
      type: Object,
      default: () => {}
    },
    mediaType: String,
    processing: Boolean
  },
  data() {
    return {
      itemData: {
        title: '',
        author: '',
        series: ''
      },
      error: '',
      isUploading: false,
      uploadFailed: false,
      uploadSuccess: false
    }
  },
  computed: {
    isPodcast() {
      return this.mediaType === 'podcast'
    },
    directory() {
      if (!this.itemData.title) return ''
      if (this.isPodcast) return this.itemData.title

      if (this.itemData.series && this.itemData.author) {
        return Path.join(this.itemData.author, this.itemData.series, this.itemData.title)
      } else if (this.itemData.author) {
        return Path.join(this.itemData.author, this.itemData.title)
      } else {
        return this.itemData.title
      }
    }
  },
  methods: {
    setUploadStatus(status) {
      this.isUploading = status === 'uploading'
      this.uploadFailed = status === 'failed'
      this.uploadSuccess = status === 'success'
    },
    titleUpdated() {
      this.error = ''
    },
    getData() {
      if (!this.itemData.title) {
        this.error = 'Must have a title'
        return null
      }
      this.error = ''
      var files = this.item.itemFiles.concat(this.item.otherFiles)
      return {
        index: this.item.index,
        ...this.itemData,
        files
      }
    }
  },
  mounted() {
    if (this.item) {
      this.itemData.title = this.item.title
      this.itemData.author = this.item.author
      this.itemData.series = this.item.series
    }
  }
}
</script>