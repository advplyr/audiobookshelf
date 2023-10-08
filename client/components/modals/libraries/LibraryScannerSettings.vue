<template>
  <div class="w-full h-full px-1 md:px-4 py-1 mb-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg text-gray-200">Metadata order of precedence</h2>
      <ui-btn small @click="resetToDefault">Reset to default</ui-btn>
    </div>

    <draggable v-model="metadataSourceMapped" v-bind="dragOptions" class="list-group" draggable=".item" handle=".drag-handle" tag="ul" @start="drag = true" @end="drag = false" @update="draggableUpdate">
      <transition-group type="transition" :name="!drag ? 'flip-list' : null">
        <li v-for="(source, index) in metadataSourceMapped" :key="source.id" :class="source.include ? 'item' : 'opacity-50'" class="w-full px-2 flex items-center relative border border-white/10">
          <span class="material-icons drag-handle text-xl text-gray-400 hover:text-gray-50 mr-2 md:mr-4">reorder</span>
          <div class="text-center py-1 w-8 min-w-8">
            {{ source.include ? index + 1 : '' }}
          </div>
          <div class="flex-grow px-4 py-3">{{ source.name }}</div>
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
          name: 'Audio file meta tags',
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
    }
  },
  methods: {
    resetToDefault() {
      this.metadataSourceMapped = []
      for (const key in this.metadataSourceData) {
        this.metadataSourceMapped.push({ ...this.metadataSourceData[key] })
      }
      this.$emit('update', this.getLibraryData())
    },
    getLibraryData() {
      return {
        settings: {
          metadataPrecedence: this.metadataSourceMapped.map((source) => (source.include ? source.id : null)).filter((s) => s)
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
          this.metadataSourceMapped.push(unusedSourceData)
        }
      }
    }
  },
  mounted() {
    this.init()
  }
}
</script>