<template>
  <div class="relative w-full py-4 px-6 border border-white border-opacity-10 shadow-lg rounded-md my-6">
    <div class="absolute -top-3 -left-3 w-8 h-8 bg-bg border border-white border-opacity-10 flex items-center justify-center rounded-full">
      <p class="text-base text-white text-opacity-80 font-mono">#{{ item.index }}</p>
    </div>

    <div v-if="!processing && !uploadFailed && !uploadSuccess" class="absolute -top-3 -right-3 w-8 h-8 bg-bg border border-white border-opacity-10 flex items-center justify-center rounded-full hover:bg-error cursor-pointer" @click="$emit('remove')">
      <span class="text-base text-white text-opacity-80 font-mono material-symbols">close</span>
    </div>

    <template v-if="!uploadSuccess && !uploadFailed">
      <widgets-alert v-if="error" type="error">
        <p class="text-base">{{ error }}</p>
      </widgets-alert>

      <div class="flex my-2 -mx-2">
        <div class="w-1/2 px-2">
          <ui-text-input-with-label v-model.trim="itemData.title" :disabled="processing" :label="$strings.LabelTitle" @input="titleUpdated" />
        </div>
        <div class="w-1/2 px-2">
          <div v-if="!isPodcast" class="flex items-end">
            <ui-text-input-with-label v-model.trim="itemData.author" :disabled="processing" :label="$strings.LabelAuthor" />
            <ui-tooltip :text="$strings.LabelUploaderItemFetchMetadataHelp">
              <div class="ml-2 mb-1 w-8 h-8 bg-bg border border-white border-opacity-10 flex items-center justify-center rounded-full hover:bg-primary cursor-pointer" @click="fetchMetadata">
                <span class="text-base text-white text-opacity-80 font-mono material-symbols">sync</span>
              </div>
            </ui-tooltip>
          </div>
          <div v-else class="w-full">
            <p class="px-1 text-sm font-semibold">
              {{ $strings.LabelDirectory }}
              <em class="font-normal text-xs pl-2">(auto)</em>
            </p>
            <ui-text-input :value="directory" disabled class="w-full font-mono text-xs" />
          </div>
        </div>
      </div>
      <div v-if="!isPodcast" class="flex my-2 -mx-2">
        <div class="w-1/2 px-2">
          <ui-text-input-with-label v-model.trim="itemData.series" :disabled="processing" :label="$strings.LabelSeries" note="(optional)" inputClass="h-10" />
        </div>
        <div class="w-1/2 px-2">
          <div class="w-full">
            <label class="px-1 text-sm font-semibold">
              {{ $strings.LabelDirectory }}
              <em class="font-normal text-xs pl-2">(auto)</em>
            </label>
            <ui-text-input :value="directory" disabled class="w-full font-mono text-xs h-10" />
          </div>
        </div>
      </div>

      <tables-uploaded-files-table :files="item.itemFiles" :title="$strings.HeaderItemFiles" class="mt-8" />
      <tables-uploaded-files-table v-if="item.otherFiles.length" :title="$strings.HeaderOtherFiles" :files="item.otherFiles" />
      <tables-uploaded-files-table v-if="item.ignoredFiles.length" :title="$strings.HeaderIgnoredFiles" :files="item.ignoredFiles" />
    </template>
    <widgets-alert v-if="uploadSuccess" type="success">
      <p class="text-base">"{{ itemData.title }}" {{ $strings.MessageUploaderItemSuccess }}</p>
    </widgets-alert>
    <widgets-alert v-if="uploadFailed" type="error">
      <p class="text-base">"{{ itemData.title }}" {{ $strings.MessageUploaderItemFailed }}</p>
    </widgets-alert>

    <div v-if="isNonInteractable" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-20">
      <ui-loading-indicator :text="nonInteractionLabel" />
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
    processing: Boolean,
    provider: String
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
      uploadSuccess: false,
      isFetchingMetadata: false
    }
  },
  computed: {
    isPodcast() {
      return this.mediaType === 'podcast'
    },
    directory() {
      if (!this.itemData.title) return ''
      if (this.isPodcast) return this.itemData.title

      const outputPathParts = [this.itemData.author, this.itemData.series, this.itemData.title]
      const cleanedOutputPathParts = outputPathParts.filter(Boolean).map((part) => this.$sanitizeFilename(part))

      return Path.join(...cleanedOutputPathParts)
    },
    isNonInteractable() {
      return this.isUploading || this.isFetchingMetadata
    },
    nonInteractionLabel() {
      if (this.isUploading) {
        return this.$strings.MessageUploading
      } else if (this.isFetchingMetadata) {
        return this.$strings.LabelFetchingMetadata
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
    async fetchMetadata() {
      if (!this.itemData.title.trim().length) {
        return
      }

      this.isFetchingMetadata = true
      this.error = ''

      try {
        const searchQueryString = new URLSearchParams({
          title: this.itemData.title,
          author: this.itemData.author,
          provider: this.provider
        })
        const [bestCandidate, ..._rest] = await this.$axios.$get(`/api/search/books?${searchQueryString}`)

        if (bestCandidate) {
          this.itemData = {
            ...this.itemData,
            title: bestCandidate.title,
            author: bestCandidate.author,
            series: (bestCandidate.series || [])[0]?.series
          }
        } else {
          this.error = this.$strings.ErrorUploadFetchMetadataNoResults
        }
      } catch (e) {
        console.error('Failed', e)
        this.error = this.$strings.ErrorUploadFetchMetadataAPI
      } finally {
        this.isFetchingMetadata = false
      }
    },
    getData() {
      if (!this.itemData.title) {
        this.error = this.$strings.ErrorUploadLacksTitle
        return null
      }
      this.error = ''
      var files = this.item.itemFiles.concat(this.item.otherFiles)
      return {
        index: this.item.index,
        directory: this.directory,
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
