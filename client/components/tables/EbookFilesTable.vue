<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-4 md:px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-2 md:pr-4">{{ $strings.HeaderEbookFiles }}</p>
      <div class="h-5 md:h-7 w-5 md:w-7 rounded-full bg-white/10 flex items-center justify-center">
        <span class="text-sm font-mono">{{ ebookFiles.length }}</span>
      </div>
      <div class="grow" />
      <ui-btn v-if="userIsAdmin" small :color="showFullPath ? 'bg-gray-600' : 'bg-primary'" class="mr-2 hidden md:block" @click.stop="toggleFullPath">{{ $strings.ButtonFullPath }}</ui-btn>
      <div class="cursor-pointer h-10 w-10 rounded-full hover:bg-black-400 flex justify-center items-center duration-500" :class="showFiles ? 'transform rotate-180' : ''">
        <span class="material-symbols text-4xl">&#xe313;</span>
      </div>
    </div>
    <transition name="slide">
      <div class="w-full" v-show="showFiles">
        <table class="text-sm tracksTable">
          <tr>
            <th class="text-left px-4">{{ $strings.LabelPath }}</th>
            <th class="text-left w-24 min-w-24">{{ $strings.LabelSize }}</th>
            <th class="text-left px-4 w-24">
              {{ $strings.LabelRead }} <ui-tooltip :text="$strings.LabelReadEbookWithoutProgress" direction="top" class="inline-block"><span class="material-symbols text-sm align-middle">info</span></ui-tooltip>
            </th>
            <th v-if="showMoreColumn" class="text-center w-16"></th>
          </tr>
          <template v-for="file in ebookFiles">
            <tables-ebook-files-table-row :key="file.path" :libraryItemId="libraryItemId" :showFullPath="showFullPath" :file="file" @read="readEbook" />
          </template>
        </table>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      showFiles: false,
      showFullPath: false
    }
  },
  computed: {
    libraryItemId() {
      return this.libraryItem.id
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
    libraryIsAudiobooksOnly() {
      return this.$store.getters['libraries/getLibraryIsAudiobooksOnly']
    },
    showMoreColumn() {
      return this.userCanDelete || this.userCanDownload || (this.userCanUpdate && !this.libraryIsAudiobooksOnly)
    },
    ebookFiles() {
      return (this.libraryItem.libraryFiles || []).filter((lf) => lf.fileType === 'ebook')
    }
  },
  methods: {
    toggleFullPath() {
      this.showFullPath = !this.showFullPath
      localStorage.setItem('showFullPath', this.showFullPath ? 1 : 0)
    },
    readEbook(fileIno) {
      this.$store.commit('showEReader', { libraryItem: this.libraryItem, keepProgress: false, fileId: fileIno })
    },
    clickBar() {
      this.showFiles = !this.showFiles
    }
  },
  mounted() {
    if (this.userIsAdmin) {
      this.showFullPath = !!Number(localStorage.getItem('showFullPath') || 0)
    }
  }
}
</script>
