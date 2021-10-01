<template>
  <div>
    <input ref="fileInput" id="hidden-input" type="file" :accept="inputAccept" class="hidden" @change="inputChanged" />
    <ui-btn @click="clickUpload" color="primary" type="text">Upload Cover</ui-btn>
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputAccept: '.png, .jpg, .jpeg, .webp'
    }
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
        console.log('File', file)
        this.$emit('change', file)
      }
    }
  },
  mounted() {}
}
</script>