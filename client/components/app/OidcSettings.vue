<template>
  <div class="w-full">
    <div v-for="group in sortedGroups" :key="group.id" class="mb-4">
      <p class="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-2 px-1">{{ group.label }}</p>
      <div class="flex flex-wrap">
        <template v-for="field in fieldsForGroup(group.id)">
          <!-- Action button (e.g., Auto-populate) -->
          <div v-if="field.type === 'action'" :key="field.key" class="w-36 mx-1 mt-[1.375rem] mb-2">
            <ui-btn class="h-[2.375rem] text-sm inline-flex items-center justify-center w-full" type="button" :padding-y="0" :padding-x="4" :disabled="isFieldDisabled(field)" @click.stop="$emit('action', field.key)">
              <span class="material-symbols text-base">auto_fix_high</span>
              <span class="whitespace-nowrap break-keep pl-1">{{ field.label }}</span>
            </ui-btn>
          </div>

          <!-- Text input -->
          <ui-text-input-with-label v-else-if="field.type === 'text'" :key="field.key" :value="values[field.key]" :disabled="disabled || isFieldDisabled(field)" :label="field.label" class="mb-2" @input="onFieldChange(field.key, $event)" />

          <!-- Password input -->
          <ui-text-input-with-label v-else-if="field.type === 'password'" :key="field.key" :value="values[field.key]" :disabled="disabled || isFieldDisabled(field)" :label="field.label" type="password" class="mb-2" @input="onFieldChange(field.key, $event)" />

          <!-- Boolean toggle -->
          <div v-else-if="field.type === 'boolean'" :key="field.key" class="flex items-center py-4 px-1 w-full">
            <ui-toggle-switch :value="!!values[field.key]" :disabled="disabled || isFieldDisabled(field)" @input="onFieldChange(field.key, $event)" />
            <p class="pl-4 whitespace-nowrap">{{ field.label }}</p>
            <p v-if="field.description" class="pl-4 text-sm text-gray-300">{{ field.description }}</p>
          </div>

          <!-- Select dropdown -->
          <div v-else-if="field.type === 'select'" :key="field.key" class="flex sm:items-center flex-col sm:flex-row pt-1 mb-2">
            <div class="w-44">
              <ui-dropdown :value="values[field.key]" small :items="getDropdownItems(field)" :label="field.label" :disabled="disabled || isFieldDisabled(field)" @input="onFieldChange(field.key, $event)" />
            </div>
            <p v-if="field.description" class="sm:pl-4 text-sm text-gray-300 mt-2 sm:mt-5">{{ field.description }}</p>
          </div>

          <!-- Array (multi-select) -->
          <div v-else-if="field.type === 'array'" :key="field.key" class="w-full mb-2">
            <ui-multi-select :value="values[field.key] || []" :items="values[field.key] || []" :label="field.label" :disabled="disabled || isFieldDisabled(field)" :menuDisabled="true" @input="onFieldChange(field.key, $event)" />
            <p v-if="field.description" class="sm:pl-4 text-sm text-gray-300 mb-2">{{ field.description }}</p>
          </div>

          <!-- Key-value editor -->
          <div v-else-if="field.type === 'keyvalue'" :key="field.key" class="w-full mb-2">
            <app-key-value-editor :value="values[field.key] || {}" :value-options="field.valueOptions || []" :label="field.label" :disabled="disabled || isFieldDisabled(field)" @input="onFieldChange(field.key, $event)" />
            <p v-if="field.description" class="sm:pl-4 text-sm text-gray-300 mt-1">{{ field.description }}</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    schema: {
      type: Array,
      default: () => []
    },
    groups: {
      type: Array,
      default: () => []
    },
    values: {
      type: Object,
      default: () => ({})
    },
    schemaOverrides: {
      type: Object,
      default: () => ({})
    },
    disabled: Boolean
  },
  computed: {
    sortedGroups() {
      return [...this.groups].sort((a, b) => a.order - b.order)
    }
  },
  methods: {
    fieldsForGroup(groupId) {
      return this.schema.filter((f) => f.group === groupId).sort((a, b) => a.order - b.order)
    },
    isFieldDisabled(field) {
      if (!field.dependsOn) return false
      const depValue = this.values[field.dependsOn]
      return !depValue
    },
    getDropdownItems(field) {
      // Use schema overrides if available (e.g., from discover)
      const override = this.schemaOverrides[field.key]
      const options = override?.options || field.options || []
      return options.map((opt) => ({
        text: opt.label,
        value: opt.value
      }))
    },
    onFieldChange(key, value) {
      this.$emit('update', { key, value })
    }
  }
}
</script>
