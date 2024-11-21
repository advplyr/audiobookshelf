<template>
  <div class="w-40">
    <div class="bg-bg border border-gray-500 py-2 px-5 rounded-lg flex items-center flex-col box-shadow-md">
      <div class="loader-dots block relative w-20 h-5 mt-2">
        <div class="absolute top-0 mt-1 w-3 h-3 rounded-full bg-green-500"></div>
        <div class="absolute top-0 mt-1 w-3 h-3 rounded-full bg-green-500"></div>
        <div class="absolute top-0 mt-1 w-3 h-3 rounded-full bg-green-500"></div>
        <div class="absolute top-0 mt-1 w-3 h-3 rounded-full bg-green-500"></div>
      </div>
      <div class="text-gray-200 text-xs font-light mt-2 text-center">{{ message }}</div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      default: null
    }
  },
  computed: {
    message() {
      return this.text || this.$strings.MessagePleaseWait
    }
  }
}
</script>

<style>
.loader-dots div {
  animation-timing-function: cubic-bezier(0, 1, 1, 0);
}
.loader-dots div:nth-child(1) {
  left: 8px;
  animation: loader-dots1 0.6s infinite;
}
.loader-dots div:nth-child(2) {
  left: 8px;
  animation: loader-dots2 0.6s infinite;
}
.loader-dots div:nth-child(3) {
  left: 32px;
  animation: loader-dots2 0.6s infinite;
}
.loader-dots div:nth-child(4) {
  left: 56px;
  animation: loader-dots3 0.6s infinite;
}
@keyframes loader-dots1 {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes loader-dots3 {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(0);
  }
}
@keyframes loader-dots2 {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(24px, 0);
  }
}
</style>
