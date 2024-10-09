<template>
  <div class="flex items-center px-1 overflow-hidden">
    <div class="w-8 flex items-center justify-center">
      <span v-if="isFinished" :class="taskIconStatus" class="material-symbols text-base">{{ actionIcon }}</span>
      <widgets-loading-spinner v-else />
    </div>
    <div class="flex-grow px-2 taskRunningCardContent">
      <p class="truncate text-sm">{{ title }}</p>

      <p class="truncate text-xs text-gray-300">{{ description }}</p>
      <p v-if="specialMessage" class="truncate text-xs text-gray-300">{{ specialMessage }}</p>

      <p v-if="isFailed && failedMessage" class="text-xs truncate text-red-500">{{ failedMessage }}</p>
      <p v-else-if="!isFinished && cancelingScan" class="text-xs truncate">Canceling...</p>
    </div>
    <ui-btn v-if="userIsAdminOrUp && !isFinished && isLibraryScan && !cancelingScan" color="primary" :padding-y="1" :padding-x="1" class="text-xs w-16 max-w-16 truncate mr-1" @click.stop="cancelScan">{{ this.$strings.ButtonCancel }}</ui-btn>
  </div>
</template>

<script>
export default {
  props: {
    task: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      cancelingScan: false,
      specialMessage: ''
    }
  },
  watch: {
    task: {
      immediate: true,
      handler() {
        this.initTask()
      }
    }
  },
  computed: {
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    title() {
      if (this.task.titleKey && this.$strings[this.task.titleKey]) {
        return this.$getString(this.task.titleKey, this.task.titleSubs)
      }
      return this.task.title || 'No Title'
    },
    description() {
      if (this.task.descriptionKey && this.$strings[this.task.descriptionKey]) {
        return this.$getString(this.task.descriptionKey, this.task.descriptionSubs)
      }
      return this.task.description || ''
    },
    isFinished() {
      return !!this.task.isFinished
    },
    isFailed() {
      return !!this.task.isFailed
    },
    isSuccess() {
      return this.isFinished && !this.isFailed
    },
    failedMessage() {
      if (this.task.errorKey && this.$strings[this.task.errorKey]) {
        return this.$getString(this.task.errorKey, this.task.errorSubs)
      }
      return this.task.error || ''
    },
    action() {
      return this.task.action || ''
    },
    actionIcon() {
      if (this.isFailed) {
        return 'error'
      } else if (this.isSuccess) {
        return 'done'
      }
      switch (this.action) {
        case 'download-podcast-episode':
          return 'cloud_download'
        case 'encode-m4b':
          return 'sync'
        default:
          return 'settings'
      }
    },
    taskIconStatus() {
      if (this.isFinished && this.isFailed) {
        return 'text-red-500'
      }
      if (this.isFinished && !this.isFailed) {
        return 'text-green-500'
      }

      return ''
    },
    isLibraryScan() {
      return this.action === 'library-scan' || this.action === 'library-match-all'
    }
  },
  methods: {
    initTask() {
      // special message for library scan tasks
      if (this.task?.data?.scanResults) {
        const scanResults = this.task.data.scanResults
        const strs = []
        if (scanResults.added) strs.push(this.$getString('MessageTaskScanItemsAdded', [scanResults.added]))
        if (scanResults.updated) strs.push(this.$getString('MessageTaskScanItemsUpdated', [scanResults.updated]))
        if (scanResults.missing) strs.push(this.$getString('MessageTaskScanItemsMissing', [scanResults.missing]))
        const changesDetected = strs.length > 0 ? strs.join(', ') : this.$strings.MessageTaskScanNoChangesNeeded
        const timeElapsed = scanResults.elapsed ? ` (${this.$elapsedPretty(scanResults.elapsed / 1000, false, true)})` : ''
        this.specialMessage = `${changesDetected}${timeElapsed}`
      } else {
        this.specialMessage = ''
      }
    },
    cancelScan() {
      const libraryId = this.task?.data?.libraryId
      if (!libraryId) {
        console.error('No library id in library-scan task', this.task)
        return
      }
      this.cancelingScan = true
      this.$root.socket.emit('cancel_scan', libraryId)
    }
  },
  mounted() {}
}
</script>

<style>
.taskRunningCardContent {
  width: calc(100% - 84px);
  height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
