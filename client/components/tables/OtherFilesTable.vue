<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-4">Other Files</p>
      <div class="h-7 w-7 rounded-full bg-white bg-opacity-10 flex items-center justify-center">
        <span class="text-sm font-mono">{{ files.length }}</span>
      </div>
      <div class="flex-grow" />
      <!-- <nuxt-link :to="`/audiobook/${audiobookId}/edit`" class="mr-4">
        <ui-btn small color="primary">Manage Tracks</ui-btn>
      </nuxt-link> -->
      <ui-btn small :color="showFullPath ? 'gray-600' : 'primary'" class="mr-2" @click.stop="showFullPath = !showFullPath">Full Path</ui-btn>
      <div class="cursor-pointer h-10 w-10 rounded-full hover:bg-black-400 flex justify-center items-center duration-500" :class="showFiles ? 'transform rotate-180' : ''">
        <span class="material-icons text-4xl">expand_more</span>
      </div>
    </div>
    <transition name="slide">
      <div class="w-full" v-show="showFiles">
        <table class="text-sm tracksTable">
          <tr class="font-book">
            <th class="text-left px-4">Path</th>
            <th class="text-left px-4 w-24">Filetype</th>
            <th v-if="userCanDownload" class="text-center w-20">Download</th>
          </tr>
          <template v-for="file in otherFilesCleaned">
            <tr :key="file.path">
              <td class="font-book pl-2">
                {{ showFullPath ? file.fullPath : file.path }}
              </td>
              <td class="text-xs">
                <p>{{ file.filetype }}</p>
              </td>
              <td v-if="userCanDownload" class="text-center">
                <a :href="`/s/book/${audiobookId}/${file.relativePath}?token=${userToken}`" download><span class="material-icons icon-text">download</span></a>
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
    audiobook: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      showFiles: false,
      showFullPath: false
    }
  },
  computed: {
    audiobookId() {
      return this.audiobook.id
    },
    audiobookPath() {
      return this.audiobook.path
    },
    otherFilesCleaned() {
      return this.files.map((file) => {
        var filePath = file.path.replace(/\\/g, '/')
        var audiobookPath = this.audiobookPath.replace(/\\/g, '/')

        return {
          ...file,
          relativePath: filePath
            .replace(audiobookPath + '/', '')
            .replace(/%/g, '%25')
            .replace(/#/g, '%23')
        }
      })
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    }
  },
  methods: {
    clickBar() {
      this.showFiles = !this.showFiles
    }
  },
  mounted() {}
}
</script>