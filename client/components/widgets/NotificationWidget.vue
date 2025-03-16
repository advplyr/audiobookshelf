<template>
  <div v-if="tasksToShow.length" class="w-4 h-4 mx-3 relative" v-click-outside="clickOutsideObj">
    <button type="button" :disabled="disabled" class="w-10 sm:w-full relative h-full cursor-pointer" aria-haspopup="listbox" :aria-expanded="showMenu" @click.stop.prevent="clickShowMenu">
      <div class="flex h-full items-center justify-center">
        <ui-tooltip v-if="tasksRunning" :text="$strings.LabelTasks" direction="bottom" class="flex items-center">
          <widgets-loading-spinner />
        </ui-tooltip>
        <ui-tooltip v-else :text="$strings.LabelActivities" direction="bottom" class="flex items-center">
          <span class="material-symbols text-1.5xl" :aria-label="$strings.LabelActivities" role="button">notifications</span>
        </ui-tooltip>
      </div>
      <div v-if="showUnseenSuccessIndicator" class="w-2 h-2 rounded-full bg-success pointer-events-none absolute -top-1 -right-0.5" />
      <div v-if="showUnseenSuccessIndicator" class="w-2 h-2 rounded-full bg-success/50 pointer-events-none absolute animate-ping -top-1 -right-0.5" />
    </button>
    <transition name="menu">
      <div class="sm:w-80 w-full relative">
        <div v-show="showMenu" class="absolute z-40 -mt-px w-40 sm:w-full bg-bg border border-black-200 shadow-lg rounded-md text-base ring-1 ring-black/5 overflow-auto focus:outline-hidden sm:text-sm globalTaskRunningMenu">
          <ul class="h-full w-full" role="listbox" aria-labelledby="listbox-label">
            <template v-if="tasksToShow.length">
              <template v-for="task in tasksToShow">
                <nuxt-link :key="task.id" v-if="actionLink(task)" :to="actionLink(task)">
                  <li class="text-gray-50 select-none relative hover:bg-black-400 py-1 cursor-pointer">
                    <cards-item-task-running-card :task="task" />
                  </li>
                </nuxt-link>
                <li v-else :key="task.id" class="text-gray-50 select-none relative hover:bg-black-400 py-1">
                  <cards-item-task-running-card :task="task" />
                </li>
              </template>
            </template>
            <li v-else class="py-2 px-2">
              <p>{{ $strings.MessageNoTasksRunning }}</p>
            </li>
          </ul>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  data() {
    return {
      clickOutsideObj: {
        handler: this.clickedOutside,
        events: ['mousedown'],
        isActive: true
      },
      showMenu: false,
      disabled: false,
      tasksSeen: []
    }
  },
  computed: {
    tasks() {
      return this.$store.state.tasks.tasks
    },
    tasksRunning() {
      return this.tasks.some((t) => !t.isFinished)
    },
    tasksToShow() {
      // return just the tasks that are running or failed (or show success) in the last 1 minute
      const tasks = this.tasks.filter((t) => !t.isFinished || ((t.isFailed || t.showSuccess) && t.finishedAt > new Date().getTime() - 1000 * 60)) || []
      return tasks.sort((a, b) => b.startedAt - a.startedAt)
    },
    showUnseenSuccessIndicator() {
      return this.tasksToShow.some((t) => t.isFinished && !t.isFailed && !this.tasksSeen.includes(t.id))
    }
  },
  methods: {
    clickShowMenu() {
      if (this.disabled) return
      this.showMenu = !this.showMenu
      if (this.showMenu) {
        this.tasksToShow.forEach((t) => {
          if (!this.tasksSeen.includes(t.id)) this.tasksSeen.push(t.id)
        })
      }
    },
    clickedOutside() {
      this.showMenu = false
    },
    actionLink(task) {
      switch (task.action) {
        case 'download-podcast-episode':
          return `/library/${task.data.libraryId}/podcast/download-queue`
        case 'encode-m4b':
          return `/audiobook/${task.data.libraryItemId}/manage?tool=m4b`
        case 'embed-metadata':
          return `/audiobook/${task.data.libraryItemId}/manage?tool=embed`
        case 'scan-item':
          return `/item/${task.data.libraryItemId}`
        default:
          return ''
      }
    },
    taskFinished(task) {
      // add task as seen if menu is open when it finished
      if (this.showMenu && !this.tasksSeen.includes(task.id)) {
        this.tasksSeen.push(task.id)
      }
    }
  },
  mounted() {
    this.$root.socket?.on('task_finished', this.taskFinished)
  },
  beforeDestroy() {
    this.$root.socket?.off('task_finished', this.taskFinished)
  }
}
</script>

<style>
.globalTaskRunningMenu {
  max-height: 80vh;
}
</style>
