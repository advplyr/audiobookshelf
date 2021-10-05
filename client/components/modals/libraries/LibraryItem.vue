<template>
  <div class="w-full px-4 h-12 border border-white border-opacity-10 cursor-pointer flex items-center relative -mt-px" :class="selected ? 'bg-primary bg-opacity-50' : 'hover:bg-primary hover:bg-opacity-25'" @mouseover="mouseover = true" @mouseleave="mouseover = false" @click="itemClicked">
    <div v-show="selected" class="absolute top-0 left-0 h-full w-0.5 bg-warning z-10" />
    <svg v-if="!libraryScan" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" :class="mouseover ? 'text-opacity-90' : 'text-opacity-50'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
    <svg v-else viewBox="0 0 24 24" class="h-6 w-6 text-white text-opacity-50 animate-spin">
      <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
    </svg>
    <p class="text-xl font-book pl-4" :class="mouseover ? 'underline' : ''">{{ library.name }}</p>
    <div class="flex-grow" />
    <ui-btn v-show="mouseover && !libraryScan && canScan" small color="bg" @click.stop="scan">Scan</ui-btn>
    <span v-show="mouseover && showEdit && canEdit" class="material-icons text-xl text-gray-300 hover:text-gray-50 ml-4" @click.stop="editClick">edit</span>
    <span v-show="mouseover && showEdit && canDelete" class="material-icons text-xl text-gray-300 ml-3" :class="isMain ? 'text-opacity-5 cursor-not-allowed' : 'hover:text-gray-50'" @click.stop="deleteClick">delete</span>
  </div>
</template>

<script>
export default {
  props: {
    library: {
      type: Object,
      default: () => {}
    },
    selected: Boolean,
    showEdit: Boolean
  },
  data() {
    return {
      mouseover: false
    }
  },
  computed: {
    isMain() {
      return this.library.id === 'main'
    },
    libraryScan() {
      return this.$store.getters['scanners/getLibraryScan'](this.library.id)
    },
    canEdit() {
      return this.$store.getters['user/getIsRoot']
    },
    canDelete() {
      return this.$store.getters['user/getIsRoot']
    },
    canScan() {
      return this.$store.getters['user/getIsRoot']
    }
  },
  methods: {
    itemClicked() {
      this.$emit('click', this.library)
    },
    editClick() {
      this.$emit('edit', this.library)
    },
    deleteClick() {
      if (this.isMain) return
      this.$emit('delete', this.library)
    },
    scan() {
      this.$root.socket.emit('scan', this.library.id)
    }
  },
  mounted() {}
}
</script>