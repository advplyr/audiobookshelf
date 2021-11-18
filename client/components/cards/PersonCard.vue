<template>
  <div class="h-24 flex">
    <div class="w-32">
      <img :src="imgSrc" class="w-full object-cover" />
    </div>
    <div class="flex-grow">
      <p>{{ name }}</p>
      <p class="text-sm text-gray-300">{{ description }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    person: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      placeholder: '/Logo.png'
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    _person() {
      return this.person || {}
    },
    name() {
      return this._person.name || ''
    },
    image() {
      return this._person.image || null
    },
    description() {
      return this._person.description
    },
    lastUpdate() {
      return this._person.lastUpdate
    },
    imgSrc() {
      if (!this.image) return this.placeholder
      var encodedImg = this.image.replace(/%/g, '%25').replace(/#/g, '%23')

      var url = new URL(encodedImg, document.baseURI)
      return url.href + `?token=${this.userToken}&ts=${this.lastUpdate}`
    }
  },
  methods: {},
  mounted() {}
}
</script>