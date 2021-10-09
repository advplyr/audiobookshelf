<template>
  <div class="flex h-full px-1 overflow-hidden">
    <img src="https://rpgplanner.com/wp-content/uploads/2020/06/no-photo-available.png" class="w-40 h-40 max-h-40 object-contain" style="max-height: 40px; max-width: 40px" />
    <div class="flex-grow px-2 authorSearchCardContent h-full">
      <p class="truncate text-sm">{{ author }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    author: String
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script>

<style>
.searchCardContent {
  width: calc(100% - 80px);
  height: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>