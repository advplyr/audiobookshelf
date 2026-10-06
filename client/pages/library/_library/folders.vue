<template>
  <div class="page relative" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar page="folders">
      <template #folders>
        <div class="folder-toolbar">
          <p class="folder-toolbar-count">{{ $formatNumber(currentFolderBookCount) }} {{ $strings.LabelBooks }}</p>
          <nav aria-label="Folder breadcrumb" class="folder-breadcrumbs">
            <button type="button" class="breadcrumb-link" @click="openRoot">
              <span class="material-symbols text-lg mr-1">folder_open</span>
              {{ library.name }}
            </button>
            <template v-if="currentRoot">
              <span class="material-symbols breadcrumb-separator">chevron_right</span>
              <button type="button" class="breadcrumb-link" @click="openPath(0)">{{ currentRoot.name }}</button>
            </template>
            <template v-for="(segment, index) in currentPath">
              <span :key="`separator-${index}`" class="material-symbols breadcrumb-separator">chevron_right</span>
              <button :key="`segment-${index}`" type="button" class="breadcrumb-link max-w-64 truncate" @click="openPath(index + 1)">
                {{ segment }}
              </button>
            </template>
          </nav>
          <span class="folder-toolbar-balance" aria-hidden="true"></span>
        </div>
      </template>
    </app-book-shelf-toolbar>

    <div id="bookshelf" class="w-full h-full px-4 py-6 md:p-8 relative overflow-y-auto">
      <div v-if="!loading && (visibleFolders.length || visibleItems.length)" class="folder-grid" :style="{ gridTemplateColumns: `repeat(auto-fill, ${tileSize}px)` }">
        <cards-folder-card v-for="folder in visibleFolders" :key="folder.key" :folder="folder" @click="openFolder" />

        <cards-folder-book-card v-for="item in visibleItems" :key="item.id" :item="item" />
      </div>

      <div v-if="!loading && !visibleFolders.length && !visibleItems.length" class="w-full h-full flex flex-col items-center justify-center text-white/50">
        <span class="material-symbols text-6xl mb-3">folder_off</span>
        <p class="text-lg">{{ $strings.MessageNoItems }}</p>
      </div>
    </div>

    <div v-if="loading" class="absolute top-0 left-0 w-full h-[calc(100%-40px)] mt-10 flex items-center justify-center bg-black/25">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect }) {
    const libraryId = params.library
    const libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect(`/oops?message=Library "${libraryId}" not found`)
    }
    return {
      library: libraryData.library
    }
  },
  data() {
    return {
      loading: true,
      roots: [],
      items: [],
      currentRootId: null,
      currentPath: []
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    sizeMultiplier() {
      return this.$store.getters['user/getSizeMultiplier']
    },
    tileSize() {
      return Math.round(192 * this.sizeMultiplier)
    },
    currentRoot() {
      return this.roots.find((root) => root.id === this.currentRootId) || null
    },
    itemsInRoot() {
      if (!this.currentRootId) return []
      return this.items.filter((item) => item.folderId === this.currentRootId)
    },
    visibleFolders() {
      if (!this.currentRoot) {
        return this.roots
          .map((root) => ({
            key: root.id,
            name: root.name,
            rootId: root.id,
            path: [],
            items: this.items.filter((item) => item.folderId === root.id)
          }))
          .sort(this.sortByName)
      }

      const folders = new Map()
      for (const item of this.itemsInRoot) {
        const segments = this.pathSegments(item.relPath)
        if (!this.pathStartsWith(segments, this.currentPath) || segments.length <= this.currentPath.length + 1) continue
        const name = segments[this.currentPath.length]
        const path = [...this.currentPath, name]
        if (!folders.has(name)) {
          folders.set(name, {
            key: `${this.currentRootId}:${path.join('/')}`,
            name,
            rootId: this.currentRootId,
            path,
            items: []
          })
        }
        folders.get(name).items.push(item)
      }
      return [...folders.values()].sort(this.sortByName)
    },
    visibleItems() {
      if (!this.currentRoot) return []
      return this.itemsInRoot
        .filter((item) => {
          const segments = this.pathSegments(item.relPath)
          return segments.length === this.currentPath.length + 1 && this.pathStartsWith(segments, this.currentPath)
        })
        .map((item) => ({
          ...item,
          diskName: this.pathSegments(item.relPath).slice(-1)[0] || item.title
        }))
        .sort((a, b) => this.sortByName({ name: a.diskName }, { name: b.diskName }))
    },
    currentFolderBookCount() {
      if (!this.currentRoot) return this.items.length

      return this.itemsInRoot.filter((item) => {
        const segments = this.pathSegments(item.relPath)
        return this.pathStartsWith(segments, this.currentPath)
      }).length
    }
  },
  watch: {
    currentLibraryId(newValue, oldValue) {
      if (newValue && newValue !== oldValue) this.init()
    }
  },
  methods: {
    sortByName(a, b) {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    },
    pathSegments(relPath) {
      return (relPath || '').split('/').filter(Boolean)
    },
    pathStartsWith(path, parent) {
      return parent.every((segment, index) => path[index] === segment)
    },
    openRoot() {
      this.currentRootId = null
      this.currentPath = []
    },
    openPath(length) {
      this.currentPath = this.currentPath.slice(0, length)
    },
    openFolder(folder) {
      this.currentRootId = folder.rootId
      this.currentPath = [...folder.path]
    },
    async init() {
      this.loading = true
      this.openRoot()
      const payload = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/folders`).catch((error) => {
        console.error('Failed to load library folders', error)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        return { folders: [], items: [] }
      })
      this.roots = payload.folders || []
      this.items = payload.items || []
      this.loading = false
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style scoped>
.folder-toolbar {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.folder-toolbar-count,
.folder-toolbar-balance {
  flex: 0 0 9rem;
}

.folder-toolbar-count {
  color: rgb(229 231 235);
  font-size: 1.125rem;
  font-weight: 600;
  white-space: nowrap;
}

.folder-breadcrumbs {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  min-width: 0;
  overflow-x: auto;
  padding: 0 0.5rem;
  white-space: nowrap;
  font-size: 1rem;
}

.folder-grid {
  display: grid;
  align-items: start;
  gap: 2.5rem 2rem;
}

.breadcrumb-link {
  display: inline-flex;
  align-items: center;
  color: rgb(253 224 71);
}

.breadcrumb-link:hover {
  text-decoration: underline;
}

.breadcrumb-separator {
  margin: 0 0.25rem;
  color: rgb(255 255 255 / 35%);
  font-size: 1.125rem;
}

@media (max-width: 767px) {
  .folder-toolbar-count,
  .folder-toolbar-balance {
    display: none;
  }

  .folder-breadcrumbs {
    justify-content: flex-start;
  }

  .folder-grid {
    justify-content: center;
    gap: 2rem 1rem;
  }
}
</style>
