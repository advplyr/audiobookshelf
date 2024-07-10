<template>
  <div class="w-full h-full px-1 md:px-4 py-1 mb-4">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-base md:text-lg text-gray-200">{{ $strings.HeaderMetadataOrderOfPrecedence }}</h2>
      <ui-btn small @click="resetToDefault">{{ $strings.ButtonResetToDefault }}</ui-btn>
    </div>

    <div class="flex items-center justify-between md:justify-start mb-4">
      <p class="text-sm text-gray-300 pr-2">{{ $strings.LabelMetadataOrderOfPrecedenceDescription }}</p>
      <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex">
        <a href="https://www.audiobookshelf.org/guides/book-scanner" target="_blank" class="inline-flex">
          <span class="material-symbols text-xl w-5">help_outline</span>
        </a>
      </ui-tooltip>
    </div>

    <draggable v-model="metadataSourceMapped" v-bind="dragOptions" class="list-group" draggable=".item" handle=".drag-handle" tag="ul" @start="drag = true" @end="drag = false" @update="draggableUpdate">
      <transition-group type="transition" :name="!drag ? 'flip-list' : null">
        <li v-for="(source, index) in metadataSourceMapped" :key="source.id" :class="source.include ? 'item' : 'opacity-50'" class="w-full px-2 flex items-center relative border border-white/10">
          <span class="material-symbols drag-handle text-xl text-gray-400 hover:text-gray-50 mr-2 md:mr-4">reorder</span>
          <div class="text-center py-1 w-8 min-w-8">
            {{ source.include ? getSourceIndex(source.id) : '' }}
          </div>
          <div class="flex-grow inline-flex justify-between px-4 py-3">
            {{ source.name }} <span v-if="source.include && (index === firstActiveSourceIndex || index === lastActiveSourceIndex)" class="px-2 italic font-semibold text-xs text-gray-400">{{ index === firstActiveSourceIndex ? $strings.LabelHighestPriority : $strings.LabelLowestPriority }}</span>
          </div>
          <div class="px-2 opacity-100">
            <ui-toggle-switch v-model="source.include" :off-color="'error'" @input="includeToggled(source)" />
          </div>
        </li>
      </transition-group>
    </draggable>
  </div>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  props: {
    library: {
      type: Object,
      default: () => null
    },
    processing: Boolean
  },
  data() {
    return {
      drag: false,
      dragOptions: {
        animation: 200,
        group: 'description',
        ghostClass: 'ghost'
      },
      metadataSourceData: {
        folderStructure: {
          id: 'folderStructure',
          name: 'Folder structure',
          include: true
        },
        audioMetatags: {
          id: 'audioMetatags',
          name: 'Audio file meta tags OR ebook metadata',
          include: true
        },
        nfoFile: {
          id: 'nfoFile',
          name: 'NFO file',
          include: true
        },
        txtFiles: {
          id: 'txtFiles',
          name: 'desc.txt & reader.txt files',
          include: true
        },
        opfFile: {
          id: 'opfFile',
          name: 'OPF file',
          include: true
        },
        absMetadata: {
          id: 'absMetadata',
          name: 'Audiobookshelf metadata file',
          include: true
        }
      },
      metadataSourceMapped: []
    }
  },
  computed: {
    librarySettings() {
      return this.library.settings || {}
    },
    mediaType() {
      return this.library.mediaType
    },
    isBookLibrary() {
      return this.mediaType === 'book'
    },
    firstActiveSourceIndex() {
      return this.metadataSourceMapped.findIndex((source) => source.include)
    },
    lastActiveSourceIndex() {
      return this.metadataSourceMapped.findLastIndex((source) => source.include)
    }
  },
  methods: {
    getSourceIndex(source) {
      const activeSources = (this.librarySettings.metadataPrecedence || []).map((s) => s).reverse()
      return activeSources.findIndex((s) => s === source) + 1
    },
    resetToDefault() {
      this.metadataSourceMapped = []
      for (const key in this.metadataSourceData) {
        this.metadataSourceMapped.push({ ...this.metadataSourceData[key] })
      }
      this.metadataSourceMapped.reverse()

      this.$emit('update', this.getLibraryData())
    },
    getLibraryData() {
      const metadataSourceIds = this.metadataSourceMapped.map((source) => (source.include ? source.id : null)).filter((s) => s)
      metadataSourceIds.reverse()
      return {
        settings: {
          metadataPrecedence: metadataSourceIds
        }
      }
    },
    includeToggled(source) {
      this.updated()
    },
    draggableUpdate() {
      this.updated()
    },
    updated() {
      this.$emit('update', this.getLibraryData())
    },
    init() {
      const metadataPrecedence = this.librarySettings.metadataPrecedence || []
      this.metadataSourceMapped = metadataPrecedence.map((source) => this.metadataSourceData[source]).filter((s) => s)

      for (const sourceKey in this.metadataSourceData) {
        if (!metadataPrecedence.includes(sourceKey)) {
          const unusedSourceData = { ...this.metadataSourceData[sourceKey], include: false }
          this.metadataSourceMapped.unshift(unusedSourceData)
        }
      }

      this.metadataSourceMapped.reverse()
    }
  },
  mounted() {
    this.init()
  }
}
</script>