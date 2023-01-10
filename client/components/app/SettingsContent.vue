<template>
  <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
    <div class="flex items-center mb-2">
      <h1 class="text-xl">{{ headerText }}</h1>

      <div v-if="showAddButton" class="mx-2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center" @click="clicked">
        <button type="button" class="material-icons" :aria-label="$strings.ButtonAdd + ': ' + headerText" style="font-size: 1.4rem">add</button>
      </div>
    </div>

    <p v-if="description" id="settings-description" class="mb-6 text-gray-200" v-html="description" />

    <slot></slot>
  </div>
</template>

<script>
export default {
  props: {
    headerText: String,
    description: String,
    note: String,
    showAddButton: Boolean
  },
  methods: {
    clicked() {
      this.$emit('clicked')
    }
  }
}
</script>

<style>
#settings-description a {
  color: rgb(96 165 250);
}
#settings-description a:hover {
  color: rgb(147 197 253);
  text-decoration-line: underline;
}
#settings-description code {
  font-size: 0.875rem;
  border-radius: 6px;
  background-color: rgb(82, 82, 82);
  color: white;
  padding: 2px 4px;
}
</style>