<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderServerStyling || 'Server Styling'">
      <div class="w-full max-w-3xl">
        <div class="pt-4">
          <h2 class="font-semibold">Theme Colors</h2>
          <p class="text-sm text-gray-400 mt-1">Customize the appearance of your server by adjusting these colors.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <!-- Primary Color -->
          <div class="space-y-2">
            <label class="block text-sm font-medium">Primary Color</label>
            <div class="flex items-center space-x-3">
              <input type="color" v-model="colors.primary" class="w-10 h-10 rounded cursor-pointer border border-gray-600" @input="updateColor('primary', $event.target.value)" />
              <input type="text" v-model="colors.primary" class="flex-1 bg-primary/20 border border-gray-600 rounded px-3 py-2" @input="updateColor('primary', $event.target.value)" />
            </div>
          </div>

          <!-- Primary Dark -->
          <div class="space-y-2">
            <label class="block text-sm font-medium">Primary Dark</label>
            <div class="flex items-center space-x-3">
              <input type="color" v-model="colors.primaryDark" class="w-10 h-10 rounded cursor-pointer border border-gray-600" @input="updateColor('primaryDark', $event.target.value)" />
              <input type="text" v-model="colors.primaryDark" class="flex-1 bg-primary/20 border border-gray-600 rounded px-3 py-2" @input="updateColor('primaryDark', $event.target.value)" />
            </div>
          </div>

          <!-- Success Color -->
          <div class="space-y-2">
            <label class="block text-sm font-medium">Success Color</label>
            <div class="flex items-center space-x-3">
              <input type="color" v-model="colors.success" class="w-10 h-10 rounded cursor-pointer border border-gray-600" @input="updateColor('success', $event.target.value)" />
              <input type="text" v-model="colors.success" class="flex-1 bg-primary/20 border border-gray-600 rounded px-3 py-2" @input="updateColor('success', $event.target.value)" />
            </div>
          </div>

          <!-- Warning Color -->
          <div class="space-y-2">
            <label class="block text-sm font-medium">Warning Color</label>
            <div class="flex items-center space-x-3">
              <input type="color" v-model="colors.warning" class="w-10 h-10 rounded cursor-pointer border border-gray-600" @input="updateColor('warning', $event.target.value)" />
              <input type="text" v-model="colors.warning" class="flex-1 bg-primary/20 border border-gray-600 rounded px-3 py-2" @input="updateColor('warning', $event.target.value)" />
            </div>
          </div>

          <!-- Error Color -->
          <div class="space-y-2">
            <label class="block text-sm font-medium">Error Color</label>
            <div class="flex items-center space-x-3">
              <input type="color" v-model="colors.error" class="w-10 h-10 rounded cursor-pointer border border-gray-600" @input="updateColor('error', $event.target.value)" />
              <input type="text" v-model="colors.error" class="flex-1 bg-primary/20 border border-gray-600 rounded px-3 py-2" @input="updateColor('error', $event.target.value)" />
            </div>
          </div>

          <!-- Info Color -->
          <div class="space-y-2">
            <label class="block text-sm font-medium">Info Color</label>
            <div class="flex items-center space-x-3">
              <input type="color" v-model="colors.info" class="w-10 h-10 rounded cursor-pointer border border-gray-600" @input="updateColor('info', $event.target.value)" />
              <input type="text" v-model="colors.info" class="flex-1 bg-primary/20 border border-gray-600 rounded px-3 py-2" @input="updateColor('info', $event.target.value)" />
            </div>
          </div>

          <!-- Background Color -->
          <div class="space-y-2">
            <label class="block text-sm font-medium">Background Color</label>
            <div class="flex items-center space-x-3">
              <input type="color" v-model="colors.background" class="w-10 h-10 rounded cursor-pointer border border-gray-600" @input="updateColor('background', $event.target.value)" />
              <input type="text" v-model="colors.background" class="flex-1 bg-primary/20 border border-gray-600 rounded px-3 py-2" @input="updateColor('background', $event.target.value)" />
            </div>
          </div>
        </div>

        <!-- Save Button -->
        <div class="mt-8 flex justify-end">
          <ui-btn color="bg-success" :loading="saving" @click="saveSettings">Save Changes</ui-btn>
        </div>

        <!-- Preview Section -->
        <div class="mt-12 border-t border-gray-600 pt-8">
          <h2 class="font-semibold mb-4">Preview</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Buttons -->
            <div class="space-y-2">
              <p class="text-sm font-medium mb-2">Buttons</p>
              <ui-btn color="bg-primary" class="mr-2">Primary</ui-btn>
              <ui-btn color="bg-success" class="mr-2">Success</ui-btn>
              <ui-btn color="bg-warning" class="mr-2">Warning</ui-btn>
              <ui-btn color="bg-error">Error</ui-btn>
            </div>

            <!-- Alerts -->
            <div class="space-y-2">
              <p class="text-sm font-medium mb-2">Alerts</p>
              <widgets-alert type="info" class="mb-2">This is an info alert</widgets-alert>
              <widgets-alert type="success" class="mb-2">This is a success alert</widgets-alert>
              <widgets-alert type="warning" class="mb-2">This is a warning alert</widgets-alert>
              <widgets-alert type="error">This is an error alert</widgets-alert>
            </div>
          </div>
        </div>
      </div>
    </app-settings-content>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'styling',
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      saving: false,
      colors: {
        primary: '#1e293b',
        primaryDark: '#0f172a',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        background: '#111827'
      }
    }
  },
  computed: {
    ...mapGetters(['getServerStyling'])
  },
  methods: {
    updateColor(key, value) {
      // Validate hex color
      if (!/^#[0-9A-F]{6}$/i.test(value)) return

      this.colors[key] = value
    },
    async saveSettings() {
      this.saving = true
      try {
        await this.$store.dispatch('updateServerSettings', {
          styling: this.colors
        })
        this.$toast.success('Server styling updated')
      } catch (error) {
        console.error('Failed to save styling settings:', error)
        this.$toast.error('Failed to save styling settings')
      }
      this.saving = false
    }
  },
  mounted() {
    // Load saved colors from server settings
    const serverStyling = this.getServerStyling
    if (serverStyling) {
      this.colors = { ...this.colors, ...serverStyling }
    }
  }
}
</script> 