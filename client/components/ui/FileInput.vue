<template>
  <div>
    <input ref="fileInput" type="file" :accept="accept" class="hidden" @change="inputChanged" />
    <ui-btn @click="clickUpload" color="bg-primary" class="hidden md:block w-full" type="text"><slot /></ui-btn>
    <ui-icon-btn @click="clickUpload" icon="upload" class="block md:hidden" />
  </div>
</template>

<script>
export default {
  props: {
    accept: {
      type: String,
      default: '.png, .jpg, .jpeg, .webp'
    }
  },
  data() {
    return {}
  },
  computed: {},
  methods: {
    reset() {
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = ''
      }
    },
    clickUpload() {
      if (this.$refs.fileInput) {
        this.$refs.fileInput.click()
      }
    },
    inputChanged(e) {
      if (!e.target || !e.target.files) return
      var _files = Array.from(e.target.files)
      if (_files && _files.length) {
        var file = _files[0]
        this.$emit('change', file)
      }
    }
  },
  mounted() {}
}
</script>
