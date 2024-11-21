<template>
  <div class="inline-flex toggle-btn-wrapper shadow-md">
    <button v-for="item in items" :key="item.value" type="button" class="toggle-btn outline-none relative border border-gray-600 px-4 py-1" :class="{ selected: item.value === value }" @click.stop="clickBtn(item.value)">
      {{ item.text }}
    </button>
  </div>
</template>

<script>
export default {
  props: {
    value: String,
    /**
     * [{ "text", "", "value": "" }]
     */
    items: {
      type: Array,
      default: Object
    }
  },
  data() {
    return {}
  },
  computed: {},
  methods: {
    clickBtn(value) {
      this.$emit('input', value)
    }
  },
  mounted() {}
}
</script>

<style scoped>
.toggle-btn-wrapper .toggle-btn:first-child {
  border-top-left-radius: 0.375rem /* 6px */;
  border-bottom-left-radius: 0.375rem /* 6px */;
}
.toggle-btn-wrapper .toggle-btn:last-child {
  border-top-right-radius: 0.375rem /* 6px */;
  border-bottom-right-radius: 0.375rem /* 6px */;
}
.toggle-btn-wrapper .toggle-btn:first-child::before {
  border-top-left-radius: 0.375rem /* 6px */;
  border-bottom-left-radius: 0.375rem /* 6px */;
}
.toggle-btn-wrapper .toggle-btn:last-child::before {
  border-top-right-radius: 0.375rem /* 6px */;
  border-bottom-right-radius: 0.375rem /* 6px */;
}

.toggle-btn-wrapper .toggle-btn:not(:first-child) {
  margin-left: -1px;
}

.toggle-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0);
  transition: all 0.1s ease-in-out;
}
.toggle-btn:hover:not(:disabled)::before {
  background-color: rgba(255, 255, 255, 0.1);
}
.toggle-btn:hover:not(:disabled) {
  color: white;
}

.toggle-btn {
  color: rgba(255, 255, 255, 0.75);
}
.toggle-btn.selected {
  color: white;
}
.toggle-btn.selected::before {
  background-color: rgba(255, 255, 255, 0.1);
}
button.toggle-btn:disabled::before {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>