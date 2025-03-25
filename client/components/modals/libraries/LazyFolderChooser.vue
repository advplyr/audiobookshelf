<template>
  <div class="w-full h-full bg-bg absolute top-0 left-0 px-4 py-4 z-10">
    <div class="flex items-center py-1 mb-2">
      <span class="material-symbols text-3xl cursor-pointer hover:text-gray-300" @click="$emit('back')">arrow_back</span>
      <p class="px-4 text-xl">{{ $strings.HeaderChooseAFolder }}</p>
    </div>
    <div v-if="rootDirs.length" class="w-full bg-primary/70 py-1 px-4 mb-2">
      <p class="font-mono truncate">{{ selectedPath || '/' }}</p>
    </div>
    <div v-if="rootDirs.length" class="relative flex bg-primary/50 p-4 folder-container">
      <div class="w-1/2 border-r border-bg h-full overflow-y-auto">
        <div v-if="level > 0" class="w-full p-1 cursor-pointer flex items-center hover:bg-white/10" @click="goBack">
          <span class="material-symbols fill text-yellow-200" style="font-size: 1.2rem">folder</span>
          <p class="text-base font-mono px-2">..</p>
        </div>
        <div v-for="dir in _directories" :key="dir.path" class="dir-item w-full p-1 cursor-pointer flex items-center hover:text-white text-gray-200 hover:bg-white/10" :class="dir.className" @click="selectDir(dir)">
          <span class="material-symbols fill text-yellow-200" style="font-size: 1.2rem">folder</span>
          <p class="text-base font-mono px-2 truncate">{{ dir.dirname }}</p>
          <span v-if="dir.path === selectedPath" class="material-symbols" style="font-size: 1.1rem">arrow_right</span>
        </div>
      </div>
      <div class="w-1/2 h-full overflow-y-auto">
        <div v-for="dir in _subdirs" :key="dir.path" :class="dir.className" class="dir-item w-full p-1 cursor-pointer flex items-center hover:text-white text-gray-200 hover:bg-white/10" @click="selectSubDir(dir)">
          <span class="material-symbols fill text-yellow-200" style="font-size: 1.2rem">folder</span>
          <p class="text-base font-mono px-2 truncate">{{ dir.dirname }}</p>
        </div>
      </div>
      <div v-if="loadingDirs" class="absolute inset-0 w-full h-full flex items-center justify-center bg-black/10">
        <ui-loading-indicator />
      </div>
    </div>
    <div v-else-if="initialLoad" class="py-12 text-center">
      <p>{{ $strings.MessageLoadingFolders }}</p>
    </div>
    <div v-else class="py-12 text-center max-w-sm mx-auto">
      <p class="text-lg mb-2">{{ $strings.MessageNoFoldersAvailable }}</p>
      <p class="text-gray-300 mb-2">{{ $strings.NoteFolderPicker }}</p>
    </div>

    <div class="w-full py-2">
      <ui-btn :disabled="!selectedPath" color="bg-primary" class="w-full mt-2" @click="selectFolder">{{ $strings.ButtonSelectFolderPath }}</ui-btn>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    paths: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      initialLoad: false,
      loadingDirs: false,
      isPosix: true,
      rootDirs: [],
      directories: [],
      selectedPath: '',
      subdirs: [],
      level: 0,
      currentDir: null,
      previousDir: null
    }
  },
  computed: {
    _directories() {
      return this.directories.map((d) => {
        var isUsed = !!this.paths.find((path) => path.endsWith(d.path))
        var isSelected = d.path === this.selectedPath
        var classes = []
        if (isSelected) classes.push('dir-selected')
        if (isUsed) classes.push('dir-used')
        return {
          isUsed,
          isSelected,
          className: classes.join(' '),
          ...d
        }
      })
    },
    _subdirs() {
      return this.subdirs.map((d) => {
        var isUsed = !!this.paths.find((path) => path.endsWith(d.path))
        var classes = []
        if (isUsed) classes.push('dir-used')
        return {
          isUsed,
          className: classes.join(' '),
          ...d
        }
      })
    }
  },
  methods: {
    async goBack() {
      let selPath = this.selectedPath.replace(/^\//, '')
      var splitPaths = selPath.split('/')

      let previousPath = ''
      let lookupPath = ''

      if (splitPaths.length > 2) {
        lookupPath = splitPaths.slice(0, -2).join('/')
      }
      previousPath = splitPaths.slice(0, -1).join('/')

      if (!this.isPosix) {
        // For windows drives add a trailing slash. e.g. C:/
        if (!this.isPosix && lookupPath.endsWith(':')) {
          lookupPath += '/'
        }
        if (!this.isPosix && previousPath.endsWith(':')) {
          previousPath += '/'
        }
      } else {
        // Add leading slash
        if (previousPath) previousPath = '/' + previousPath
        if (lookupPath) lookupPath = '/' + lookupPath
      }

      this.level--
      this.subdirs = this.directories
      this.selectedPath = previousPath
      this.directories = await this.fetchDirs(lookupPath, this.level)
    },
    async selectDir(dir) {
      if (dir.isUsed) return
      this.selectedPath = dir.path
      this.level = dir.level
      this.subdirs = await this.fetchDirs(dir.path, dir.level + 1)
    },
    async selectSubDir(dir) {
      if (dir.isUsed) return
      this.selectedPath = dir.path
      this.level = dir.level
      this.directories = this.subdirs
      this.subdirs = await this.fetchDirs(dir.path, dir.level + 1)
    },
    selectFolder() {
      if (!this.selectedPath) {
        console.error('No Selected path')
        return
      }
      if (this.paths.find((p) => p.startsWith(this.selectedPath))) {
        this.$toast.error(`Oops, you cannot add a parent directory of a folder already added`)
        return
      }
      this.$emit('select', this.selectedPath)
      this.selectedPath = ''
    },
    fetchDirs(path, level) {
      this.loadingDirs = true
      return this.$axios
        .$get(`/api/filesystem?path=${path}&level=${level}`)
        .then((data) => {
          console.log('Fetched directories', data.directories)
          this.isPosix = !!data.posix
          return data.directories
        })
        .catch((error) => {
          console.error('Failed to get filesystem paths', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
          return []
        })
        .finally(() => {
          this.loadingDirs = false
        })
    },
    async init() {
      this.initialLoad = true
      this.rootDirs = await this.fetchDirs('', 0)
      this.initialLoad = false

      this.directories = this.rootDirs
      this.subdirs = []
      this.selectedPath = ''
    }
  },
  mounted() {
    this.init()
  }
}
</script>



<style>
.dir-item.dir-selected {
  background-color: rgba(255, 255, 255, 0.1);
}
.dir-item.dir-used {
  background-color: rgba(255, 25, 0, 0.1);
}
.folder-container {
  max-height: calc(100% - 130px);
  height: calc(100% - 130px);
  min-height: calc(100% - 130px);
}
</style>
