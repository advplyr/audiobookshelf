<template>
  <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-2 sm:p-4 mb-8">
    <div class="flex items-center mb-2">
      <slot name="header-prefix"></slot>
      <h1 class="text-xl">{{ headerText }}</h1>

      <slot name="header-items"></slot>
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
    note: String
  },
  methods: {}
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