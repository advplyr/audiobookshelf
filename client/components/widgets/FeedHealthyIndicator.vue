<template>
  <p v-if="value" class="text-success">
    <ui-tooltip direction="top"
                :text="$strings.LabelFeedWorking">
      <span class="material-icons text-2xl">cloud_done</span>
    </ui-tooltip>
  </p>
  <p v-else class="text-error">
    <ui-tooltip direction="top"
                :text="$strings.LabelFeedNotWorking">
      <span class="material-icons text-2xl">cloud_off</span>
    </ui-tooltip>
  </p>
</template>

<script>
export default {
  props: {
    value: Boolean
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script>
