<template>
  <ui-tooltip v-if="explicit" :text="$strings.LabelExplicit" direction="top">
    <span class="material-icons ml-1" style="font-size: 0.8rem">explicit</span>
  </ui-tooltip>
</template>

<script>
export default {
  props: {
    explicit: Boolean
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script>
