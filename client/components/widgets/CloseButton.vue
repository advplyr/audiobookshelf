<template>
  <button class="bg-error text-white px-2 py-1 shadow-md" @click="$emit('click', $event)">Cancel</button>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script>

<style>
.Vue-Toastification__close-button.cancel-scan-btn {
  background-color: rgb(255, 82, 82);
  color: white;
  font-size: 0.9rem;
  opacity: 1;
  padding: 0px 10px;
  border-radius: 6px;
  font-weight: normal;
  font-family: 'Open Sans';
  margin-left: 10px;
  opacity: 0.3;
}
.Vue-Toastification__close-button.cancel-scan-btn:hover {
  background-color: rgb(235, 65, 65);
  opacity: 1;
}
</style>