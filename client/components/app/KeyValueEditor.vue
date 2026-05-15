<template>
  <div class="w-full">
    <p v-if="label" class="text-sm font-semibold px-1 mb-1" :class="disabled ? 'text-gray-300' : ''">{{ label }}</p>
    <div v-for="(entry, index) in entries" :key="index" class="flex items-center gap-2 mb-2">
      <div class="flex-grow">
        <input type="text" :value="entry.key" :disabled="disabled" class="w-full rounded-sm bg-primary text-sm px-3 py-2" :class="isDuplicateKey(entry.key, index) ? 'border border-warning' : 'border border-gray-600'" :title="isDuplicateKey(entry.key, index) ? 'Duplicate group name' : ''" placeholder="Group name" @input="updateKey(index, $event.target.value)" />
      </div>
      <div class="w-32">
        <select :value="entry.value" :disabled="disabled" class="w-full rounded-sm bg-primary border border-gray-600 text-sm px-2 py-2" @change="updateValue(index, $event.target.value)">
          <option v-for="opt in valueOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <button type="button" :disabled="disabled" class="text-gray-400 hover:text-error p-1" @click="removeEntry(index)">
        <span class="material-symbols text-xl">close</span>
      </button>
    </div>
    <p v-if="hasDuplicates" class="text-warning text-xs px-1 mb-1">Duplicate group names — only the last entry will be kept</p>
    <button type="button" :disabled="disabled" class="flex items-center text-sm text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed" @click="addEntry">
      <span class="material-symbols text-lg mr-1">add</span>
      <span>Add mapping</span>
    </button>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: Object,
      default: () => ({})
    },
    valueOptions: {
      type: Array,
      default: () => []
    },
    label: String,
    disabled: Boolean
  },
  data() {
    return {
      entries: Object.entries(this.value || {}).map(([key, value]) => ({ key, value }))
    }
  },
  computed: {
    hasDuplicates() {
      const keys = this.entries.map((e) => e.key).filter((k) => k)
      return new Set(keys).size !== keys.length
    }
  },
  watch: {
    value: {
      handler(newVal) {
        // Only rebuild entries if the prop differs from what local state would emit.
        // This prevents re-rendering (and closing dropdowns) when our own emit echoes back.
        const currentOutput = {}
        for (const entry of this.entries) {
          if (entry.key) currentOutput[entry.key] = entry.value
        }
        if (JSON.stringify(newVal || {}) !== JSON.stringify(currentOutput)) {
          this.entries = Object.entries(newVal || {}).map(([key, value]) => ({ key, value }))
        }
      },
      deep: true
    }
  },
  methods: {
    isDuplicateKey(key, index) {
      if (!key) return false
      return this.entries.some((e, i) => i !== index && e.key === key)
    },
    emitUpdate() {
      const obj = {}
      for (const entry of this.entries) {
        if (entry.key) {
          obj[entry.key] = entry.value
        }
      }
      this.$emit('input', obj)
    },
    updateKey(index, newKey) {
      this.$set(this.entries, index, { ...this.entries[index], key: newKey })
      this.emitUpdate()
    },
    updateValue(index, newValue) {
      this.$set(this.entries, index, { ...this.entries[index], value: newValue })
      this.emitUpdate()
    },
    removeEntry(index) {
      this.entries.splice(index, 1)
      this.emitUpdate()
    },
    addEntry() {
      this.entries.push({ key: '', value: this.valueOptions[0] || '' })
    }
  }
}
</script>
