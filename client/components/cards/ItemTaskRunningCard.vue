<template>
  <div class="flex items-center px-1 overflow-hidden">
    <div class="w-8 flex items-center justify-center">
      <!-- <div class="text-lg"> -->
      <span v-if="isFinished" :class="taskIconStatus" class="material-icons text-base">{{ actionIcon }}</span>
      <widgets-loading-spinner v-else />
      <!-- </div> -->
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
      return !!this.task.isFinished
    },
    isFailed() {
      return !!this.task.isFailed
    },
    isSuccess() {
      return this.isFinished && !this.isFailed
    },
    failedMessage() {
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
    }
  },
  methods: {},
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
