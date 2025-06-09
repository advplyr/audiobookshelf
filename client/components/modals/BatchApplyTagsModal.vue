<template>
  <modals-modal v-model="show" name="batch-apply-tags" :processing="processing" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate">Apply Tags</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="py-4 px-4">
          <h1 class="text-2xl">Apply Tags to {{ selectedItemsCount }} Items</h1>
          <p class="text-sm text-gray-300 mt-2">Add or remove tags from {{ selectedItemsCount }} selected items</p>
        </div>

        <div class="px-4 pb-4">
          <div class="mb-4">
            <ui-multi-select ref="tagsMultiSelect" v-model="selectedTags" :items="allTags" :label="addMode ? 'Tags to add' : 'Tags to remove'" @newItem="newTagItem" @removedItem="removedTagItem" />
          </div>

          <div class="mb-4">
            <div class="flex items-center mb-2">
              <ui-toggle-switch v-model="addMode" />
              <p class="text-sm ml-2">{{ addMode ? 'Add tags to items' : 'Remove tags from items' }}</p>
            </div>
            <p class="text-xs text-gray-400">
              {{ addMode ? 'Selected tags will be added to all selected items' : 'Selected tags will be removed from all selected items' }}
            </p>
          </div>

          <div class="flex justify-end space-x-2">
            <ui-btn small @click="show = false">{{ $strings.ButtonCancel }}</ui-btn>
            <ui-btn color="bg-success" small :disabled="!selectedTags.length" @click="applyTags">
              {{ addMode ? 'Add Tags' : 'Remove Tags' }}
            </ui-btn>
          </div>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    selectedMediaItems: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      processing: false,
      selectedTags: [],
      allTags: [],
      addMode: true,
      localSelectedItems: [] // Local copy to avoid Vuex mutation issues
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    },
    selectedMediaItems: {
      handler(newItems) {
        // Create a local copy to avoid Vuex mutation issues
        this.localSelectedItems = newItems ? [...newItems] : []
      },
      immediate: true
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    selectedItemsCount() {
      return this.localSelectedItems.length
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    }
  },
  methods: {
    init() {
      this.selectedTags = []
      this.loadTags()
      // Ensure we have a local copy of selected items
      this.localSelectedItems = this.selectedMediaItems ? [...this.selectedMediaItems] : []
    },
    loadTags() {
      // Get tags from filter data (existing tags in the library)
      this.allTags = [...(this.filterData.tags || [])]
    },
    newTagItem(tag) {
      if (!this.allTags.includes(tag)) {
        this.allTags = [...this.allTags, tag]
      }
    },
    removedTagItem(tag) {
      // Don't remove from allTags as user might want to re-add
    },
    async applyTags() {
      if (!this.selectedTags.length || !this.localSelectedItems.length) return

      this.processing = true

      try {
        // Get the current library items to see their existing tags
        const libraryItemsResponse = await this.$axios.$post('/api/items/batch/get', {
          libraryItemIds: this.localSelectedItems.map((item) => item.id)
        })

        const libraryItems = libraryItemsResponse.libraryItems || []

        // Prepare update payloads for each item
        const updatePayloads = libraryItems.map((item) => {
          let currentTags = item.media?.tags || []

          let newTags
          if (this.addMode) {
            // Add tags: merge current tags with selected tags (remove duplicates)
            newTags = [...new Set([...currentTags, ...this.selectedTags])]
          } else {
            // Remove tags: filter out selected tags from current tags
            newTags = currentTags.filter((tag) => !this.selectedTags.includes(tag))
          }

          return {
            id: item.id,
            mediaPayload: {
              tags: newTags
            }
          }
        })

        await this.$axios.$post('/api/items/batch/update', updatePayloads)

        this.$toast.success(this.addMode ? `Successfully added ${this.selectedTags.length} tag(s) to ${this.selectedItemsCount} item(s)` : `Successfully removed ${this.selectedTags.length} tag(s) from ${this.selectedItemsCount} item(s)`)

        this.show = false
        this.$emit('tagsApplied')
      } catch (error) {
        console.error('Failed to apply tags', error)
        const errorMsg = error.response?.data || 'Failed to apply tags'
        this.$toast.error(errorMsg)
      } finally {
        this.processing = false
      }
    }
  }
}
</script> 