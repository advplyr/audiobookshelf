<template>
  <div class="flex items-center h-full px-1 overflow-hidden">
    <div class="h-5 w-5 min-w-5 text-lg mr-1.5 flex items-center justify-center">
      <span v-if="isFinished" :class="taskIconStatus" class="material-icons text-base">{{actionIcon}}</span>
      <widgets-loading-spinner v-else />
    </div>
    <div class="flex-grow px-2 taskRunningCardContent">
      <p class="truncate text-sm">{{ title }}</p>

      <p class="truncate text-xs text-gray-300">{{ description }}</p>

      <p v-if="isFailed && failedMessage" class="text-xs truncate text-red-500">{{ failedMessage }}</p>
    </div>
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
    return {}
  },
  computed: {
    title() {
      return this.task.title || 'No Title'
    },
    description() {
      return this.task.description || ''
    },
    details() {
      return this.task.details || 'Unknown'
    },
    isFinished() {
      return this.task.isFinished || false
    },
    isFailed() {
      return this.task.isFailed || false
    },
    failedMessage() {
      return this.task.error || ''
    },
    action() {
      return this.task.action || ''
    },
    actionIcon() {
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
    }
  },
  methods: {
  },
  mounted() {}
}
</script>

<style>
.taskRunningCardContent {
  width: calc(100% - 80px);
  height: 75px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
