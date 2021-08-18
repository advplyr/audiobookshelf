<template>
  <div class="w-full h-10 relative">
    <div id="toolbar" class="absolute top-0 left-0 w-full h-full z-10 flex items-center px-8">
      <p>Order By: {{ orderBy }}</p>
      <p class="px-4">Desc: {{ orderDesc ? 'Desc' : 'Asc' }}</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {
    orderBy() {
      return this.$store.state.settings.orderBy
    },
    orderDesc() {
      return this.$store.state.settings.orderDesc
    }
  },
  methods: {},
  mounted() {}
}
</script>


<style>
#toolbar {
  box-shadow: 0px 8px 8px #111111aa;
}
</style>