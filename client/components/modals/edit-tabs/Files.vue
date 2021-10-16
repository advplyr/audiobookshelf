<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <tables-all-files-table :audiobook="audiobook" />
  </div>
</template>

<script>
export default {
  props: {
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {}
  },
  computed: {},
  methods: {}
}
</script>