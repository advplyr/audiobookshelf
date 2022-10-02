<template>
  <div v-if="tasksRunning" class="w-4 h-4 mx-3 relative">
    <div class="flex h-full items-center justify-center">
      <widgets-loading-spinner />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {
    tasks() {
      return this.$store.state.tasks.tasks
    },
    tasksRunning() {
      return this.tasks.some((t) => !t.isFinished)
    }
  },
  methods: {},
  mounted() {}
}
</script>