<template>
  <div class="w-screen h-screen overflow-hidden page">
    <div class="flex h-1/3 items-center justify-center">
      <h1 class="text-2xl">Oops... {{ message }}</h1>
    </div>
  </div>
</template>

<script>
export default {
  asyncData({ query }) {
    return {
      message: query.message || ''
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