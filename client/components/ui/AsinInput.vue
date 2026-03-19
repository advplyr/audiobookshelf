<template>
  <div class="w-full">
    <label v-if="label" class="px-1 text-sm font-semibold">{{ label }}</label>
    <div class="relative">
      <input ref="input" :value="value" type="text" :placeholder="placeholder" dir="auto" class="rounded-sm bg-primary text-gray-200 focus:bg-bg focus:outline-hidden border h-full w-full px-3 py-2 focus:border-gray-300 border-gray-600" @input="onInput" @paste="onPaste" @blur="onBlur" />
    </div>
    <p v-if="extracted" class="text-success text-xs mt-1 px-1">
      <span class="material-symbols text-xs align-middle" style="font-size: 0.875rem">check_circle</span>
      {{ extractedMessage }}
    </p>
    <p v-else-if="value && isValid" class="text-green-500 text-xs mt-1 px-1">
      <span class="material-symbols text-xs align-middle" style="font-size: 0.875rem">check</span>
      {{ validMessage }}
    </p>
    <p v-else-if="value && !isValid" class="text-red-500 text-xs mt-1 px-1">
      <span class="material-symbols text-xs align-middle" style="font-size: 0.875rem">error</span>
      {{ invalidMessage }}
    </p>
  </div>
</template>

<script>
/**
 * Specialized input component for Audible ASIN fields.
 * - Validates 10 alphanumeric characters
 * - Extracts ASIN from pasted Audible URLs
 * - Shows validation feedback
 */
export default {
  props: {
    value: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'B08G9PRS1K or paste Audible URL'
    },
    extractedMessage: {
      type: String,
      default: 'ASIN extracted from URL'
    },
    validMessage: {
      type: String,
      default: 'Valid ASIN format'
    },
    invalidMessage: {
      type: String,
      default: 'Invalid ASIN (must be exactly 10 alphanumeric characters)'
    }
  },
  data() {
    return {
      extracted: false
    }
  },
  computed: {
    isValid() {
      if (!this.value) return false
      return /^[A-Z0-9]{10}$/i.test(this.value)
    }
  },
  watch: {
    value(newVal, oldVal) {
      // Reset extracted flag when value changes externally
      if (newVal !== oldVal) {
        this.extracted = false
      }
    }
  },
  methods: {
    /**
     * Extract ASIN from Audible URL or return null
     */
    extractAsinFromUrl(input) {
      if (!input) return null

      // If already looks like ASIN, return as-is (uppercase)
      if (/^[A-Z0-9]{10}$/i.test(input)) {
        return input.toUpperCase()
      }

      // Try to extract from URL - handles:
      // /series/B08WJ59784 (ASIN directly after /series/)
      // /series/Series-Name/B08WJ59784 (ASIN after series name)
      const urlMatch = input.match(/\/series\/(?:[^/]+\/)?([A-Z0-9]{10})(?:[/?#]|$)/i)
      if (urlMatch) {
        return urlMatch[1].toUpperCase()
      }

      // Fallback: look for B0-style ASIN anywhere (common for Audible)
      const b0Match = input.match(/\b(B0[A-Z0-9]{8})\b/i)
      if (b0Match) {
        return b0Match[1].toUpperCase()
      }

      return null
    },

    onInput(e) {
      const val = (e?.target?.value ?? '').trim()
      this.extracted = false
      this.$emit('input', val)
    },

    onPaste(e) {
      e.preventDefault()
      const pasted = (e.clipboardData?.getData('text') ?? '').trim()
      if (!pasted) return

      const extractedAsin = this.extractAsinFromUrl(pasted)
      const finalVal = extractedAsin || pasted

      this.extracted = !!(extractedAsin && extractedAsin !== pasted)
      this.$emit('input', finalVal)

      // Sync the input element
      if (e.target) {
        e.target.value = finalVal
      }
    },

    onBlur(e) {
      const val = (e?.target?.value ?? '').trim()
      if (!val) {
        this.extracted = false
        this.$emit('input', '')
        return
      }

      const extractedAsin = this.extractAsinFromUrl(val)
      if (extractedAsin && extractedAsin !== val) {
        this.extracted = true
        this.$emit('input', extractedAsin)
        if (e.target) e.target.value = extractedAsin
      } else {
        this.$emit('input', val)
      }
      this.$emit('blur')
    },

    setFocus() {
      if (this.$refs.input) this.$refs.input.focus()
    },

    blur() {
      if (this.$refs.input) this.$refs.input.blur()
    }
  }
}
</script>
