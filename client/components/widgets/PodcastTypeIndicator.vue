<template>
  <div>
    <template v-if="type == 'bonus'">
      <ui-tooltip text="Bonus" direction="top">
        <span class="material-symbols ml-1" style="font-size: 0.8rem">local_play</span>
      </ui-tooltip>
    </template>
    <template v-if="type == 'trailer'">
      <ui-tooltip text="Trailer" direction="top">
        <span class="material-symbols ml-1" style="font-size: 0.8rem">local_movies</span>
      </ui-tooltip>
    </template>
  </div>
</template>

<script>
export default {
  props: {
    type: {
      type: String,
      default: 'full'
    }
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script>
