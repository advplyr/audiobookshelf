<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-4 py-2 flex items-center cursor-pointer">
      <p class="pr-4">All Files</p>
      <span class="bg-black-400 rounded-xl py-1 px-2 text-sm font-mono">{{ allFiles.length }}</span>
      <div class="flex-grow" />

      <ui-btn small :color="showFullPath ? 'gray-600' : 'primary'" @click.stop="showFullPath = !showFullPath">Full Path</ui-btn>
    </div>
    <div class="w-full">
      <table class="text-sm tracksTable">
        <tr class="font-book">
          <th class="text-left px-4">Path</th>
          <th class="text-left px-4 w-24">Filetype</th>
          <th v-if="userCanDownload" class="text-center w-20">Download</th>
        </tr>
        <template v-for="file in allFiles">
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
  </div>
</template>

<script>
export default {
  props: {
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
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
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    isMissing() {
      return this.audiobook.isMissing
    },
    showDownload() {
      return this.userCanDownload && !this.isMissing
    },
    otherFiles() {
      return this.audiobook.otherFiles || []
    },
    audioFiles() {
      return this.audiobook.audioFiles || []
    },
    audioFilesCleaned() {
      return this.audioFiles.map((af) => {
        return {
          path: af.path,
          fullPath: af.fullPath,
          relativePath: this.getRelativePath(af.path),
          filetype: 'audio'
        }
      })
    },
    otherFilesCleaned() {
      return this.otherFiles.map((af) => {
        return {
          path: af.path,
          fullPath: af.fullPath,
          relativePath: this.getRelativePath(af.path),
          filetype: af.filetype
        }
      })
    },
    allFiles() {
      return this.audioFilesCleaned.concat(this.otherFilesCleaned)
    }
  },
  methods: {
    getRelativePath(path) {
      var relativePath = path.replace(/\\/g, '/').replace(this.audiobookPath.replace(/\\/g, '/') + '/', '')
      return this.$encodeUriPath(relativePath)
    }
  },
  mounted() {}
}
</script>