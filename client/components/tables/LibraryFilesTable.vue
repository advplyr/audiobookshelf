<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-4 md:px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-2 md:pr-4">Library Files</p>
      <div class="h-5 md:h-7 w-5 md:w-7 rounded-full bg-white bg-opacity-10 flex items-center justify-center">
        <span class="text-sm font-mono">{{ files.length }}</span>
      </div>
      <div class="flex-grow" />
      <ui-btn small :color="showFullPath ? 'gray-600' : 'primary'" class="mr-2 hidden md:block" @click.stop="showFullPath = !showFullPath">Full Path</ui-btn>
      <div class="cursor-pointer h-10 w-10 rounded-full hover:bg-black-400 flex justify-center items-center duration-500" :class="showFiles ? 'transform rotate-180' : ''">
        <span class="material-icons text-4xl">expand_more</span>
      </div>
    </div>
    <transition name="slide">
      <div class="w-full" v-show="showFiles">
        <table class="text-sm tracksTable">
          <tr class="font-book">
            <th class="text-left px-4">Path</th>
            <th class="text-left w-24 min-w-24">Size</th>
            <th class="text-left px-4 w-24">Filetype</th>
            <th v-if="userCanDownload && !isMissing" class="text-center w-20">Download</th>
          </tr>
          <template v-for="file in files">
            <tr :key="file.path">
              <td class="font-book px-4">
                {{ showFullPath ? file.metadata.path : file.metadata.relPath }}
              </td>
              <td class="font-mono">
                {{ $bytesPretty(file.metadata.size) }}
              </td>
              <td class="text-xs">
                <div class="flex items-center">
                  <span v-if="file.filetype === 'ebook'" class="material-icons text-base mr-1 cursor-pointer text-white text-opacity-60 hover:text-opacity-100" @click="readEbookClick(file)">auto_stories </span>
                  <p>{{ file.fileType }}</p>
                </div>
              </td>
              <td v-if="userCanDownload && !isMissing" class="text-center">
                <a :href="`/s/item/${libraryItemId}${$encodeUriPath(file.metadata.relPath)}?token=${userToken}`" download><span class="material-icons icon-text">download</span></a>
              </td>
            </tr>
          </template>
        </table>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    files: {
      type: Array,
      default: () => []
    },
    libraryItemId: String,
    isMissing: Boolean
  },
  data() {
    return {
      showFiles: false,
      showFullPath: false
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    }
  },
  methods: {
    readEbookClick(file) {
      // this.$store.commit('showEReaderForFile', { audiobook: this.audiobook, file })
    },
    clickBar() {
      this.showFiles = !this.showFiles
    }
  },
  mounted() {}
}
</script>