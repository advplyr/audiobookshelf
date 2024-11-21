<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderEmailSettings" :description="''">
      <template #header-items>
        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides/send_to_ereader" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>
      </template>

      <form @submit.prevent="submitForm">
        <div class="flex items-center -mx-1 mb-2">
          <div class="w-full md:w-3/4 px-1">
            <ui-text-input-with-label ref="hostInput" v-model="newSettings.host" :disabled="savingSettings" :label="$strings.LabelHost" />
          </div>
          <div class="w-full md:w-1/4 px-1">
            <ui-text-input-with-label ref="portInput" v-model="newSettings.port" type="number" :disabled="savingSettings" :label="$strings.LabelPort" />
          </div>
        </div>

        <div class="flex items-center mb-2 py-3">
          <div class="w-full md:w-1/2 px-1">
            <!-- secure toggle -->
            <div class="flex items-center">
              <ui-toggle-switch labeledBy="email-settings-secure" v-model="newSettings.secure" :disabled="savingSettings" />
              <ui-tooltip :text="$strings.LabelEmailSettingsSecureHelp">
                <div class="pl-4 flex items-center">
                  <span id="email-settings-secure">{{ $strings.LabelEmailSettingsSecure }}</span>
                  <span class="material-symbols text-lg pl-1">info</span>
                </div>
              </ui-tooltip>
            </div>
          </div>
          <div class="w-full md:w-1/2 px-1">
            <!-- reject unauthorized toggle -->
            <div class="flex items-center">
              <ui-toggle-switch labeledBy="email-settings-reject-unauthorized" v-model="newSettings.rejectUnauthorized" :disabled="savingSettings" />
              <ui-tooltip :text="$strings.LabelEmailSettingsRejectUnauthorizedHelp">
                <div class="pl-4 flex items-center">
                  <span id="email-settings-reject-unauthorized">{{ $strings.LabelEmailSettingsRejectUnauthorized }}</span>
                  <span class="material-symbols text-lg pl-1">info</span>
                </div>
              </ui-tooltip>
            </div>
          </div>
        </div>

        <div class="flex items-center -mx-1 mb-2">
          <div class="w-full md:w-1/2 px-1">
            <ui-text-input-with-label ref="userInput" v-model="newSettings.user" :disabled="savingSettings" :label="$strings.LabelUsername" />
          </div>
          <div class="w-full md:w-1/2 px-1">
            <ui-text-input-with-label ref="passInput" v-model="newSettings.pass" type="password" :disabled="savingSettings" :label="$strings.LabelPassword" />
          </div>
        </div>

        <div class="flex items-center -mx-1 mb-2">
          <div class="w-full md:w-1/2 px-1">
            <ui-text-input-with-label ref="fromInput" v-model="newSettings.fromAddress" :disabled="savingSettings" :label="$strings.LabelEmailSettingsFromAddress" />
          </div>
          <div class="w-full md:w-1/2 px-1">
            <ui-text-input-with-label ref="testInput" v-model="newSettings.testAddress" :disabled="savingSettings" :label="$strings.LabelEmailSettingsTestAddress" />
          </div>
        </div>

        <div class="flex items-center justify-between pt-4">
          <ui-btn v-if="hasUpdates" :disabled="savingSettings" type="button" @click="resetChanges">{{ $strings.ButtonReset }}</ui-btn>
          <ui-btn v-else :loading="sendingTest" :disabled="savingSettings || !newSettings.host" type="button" @click="sendTestClick">{{ $strings.ButtonTest }}</ui-btn>
          <ui-btn :loading="savingSettings" :disabled="!hasUpdates" type="submit">{{ $strings.ButtonSave }}</ui-btn>
        </div>
      </form>

      <div v-show="loading" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-25 flex items-center justify-center">
        <ui-loading-indicator />
      </div>
    </app-settings-content>

    <app-settings-content :header-text="$strings.HeaderEreaderDevices" :description="$strings.MessageEreaderDevices">
      <template #header-items>
        <div class="flex-grow" />

        <ui-btn color="primary" small @click="addNewDeviceClick">{{ $strings.ButtonAddDevice }}</ui-btn>
      </template>

      <table v-if="existingEReaderDevices.length" class="tracksTable mt-4">
        <tr>
          <th class="text-left">{{ $strings.LabelName }}</th>
          <th class="text-left">{{ $strings.LabelEmail }}</th>
          <th class="text-left">{{ $strings.LabelAccessibleBy }}</th>
          <th class="w-40"></th>
        </tr>
        <tr v-for="device in existingEReaderDevices" :key="device.name">
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ device.name }}</p>
          </td>
          <td class="text-left">
            <p class="text-sm md:text-base text-gray-100">{{ device.email }}</p>
          </td>
          <td class="text-left">
            <p class="text-sm md:text-base text-gray-100">{{ getAccessibleBy(device) }}</p>
          </td>
          <td class="w-40">
            <div class="flex justify-end items-center h-10">
              <ui-icon-btn icon="edit" borderless :size="8" icon-font-size="1.1rem" :disabled="deletingDeviceName === device.name" class="mx-1" @click="editDeviceClick(device)" />
              <ui-icon-btn icon="delete" borderless :size="8" icon-font-size="1.1rem" :disabled="deletingDeviceName === device.name" @click="deleteDeviceClick(device)" />
            </div>
          </td>
        </tr>
      </table>
      <div v-else-if="!loading" class="text-center py-4">
        <p class="text-lg text-gray-100">{{ $strings.MessageNoDevices }}</p>
      </div>
    </app-settings-content>

    <modals-emails-e-reader-device-modal v-model="showEReaderDeviceModal" :users="users" :existing-devices="existingEReaderDevices" :ereader-device="selectedEReaderDevice" @update="ereaderDevicesUpdated" :loadUsers="loadUsers" />
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      users: [],
      loading: false,
      savingSettings: false,
      sendingTest: false,
      deletingDeviceName: null,
      settings: null,
      newSettings: {
        host: null,
        port: 465,
        secure: true,
        rejectUnauthorized: true,
        user: null,
        pass: null,
        testAddress: null,
        fromAddress: null
      },
      newEReaderDevice: {
        name: '',
        email: ''
      },
      selectedEReaderDevice: null,
      showEReaderDeviceModal: false
    }
  },
  computed: {
    hasUpdates() {
      if (!this.settings) return true
      for (const key in this.newSettings) {
        if (key === 'ereaderDevices') continue
        if (this.newSettings[key] !== this.settings[key]) return true
      }
      return false
    },
    existingEReaderDevices() {
      return this.settings?.ereaderDevices || []
    }
  },
  methods: {
    resetChanges() {
      this.newSettings = {
        ...this.settings
      }
    },
    async loadUsers() {
      if (this.users.length) return
      this.users = await this.$axios
        .$get('/api/users')
        .then((res) => {
          return res.users.sort((a, b) => {
            return a.createdAt - b.createdAt
          })
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
          return []
        })
    },
    getAccessibleBy(device) {
      const user = device.availabilityOption
      if (user === 'userOrUp') return 'Users (excluding Guests)'
      if (user === 'guestOrUp') return 'Users (including Guests)'
      if (user === 'specificUsers') {
        return device.users.map((id) => this.users.find((u) => u.id === id)?.username).join(', ')
      }
      return 'Admins Only'
    },
    editDeviceClick(device) {
      this.selectedEReaderDevice = device
      this.showEReaderDeviceModal = true
    },
    deleteDeviceClick(device) {
      const payload = {
        message: this.$getString('MessageConfirmDeleteDevice', [device.name]),
        callback: (confirmed) => {
          if (confirmed) {
            this.deleteDevice(device)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    deleteDevice(device) {
      const payload = {
        ereaderDevices: this.existingEReaderDevices.filter((d) => d.name !== device.name)
      }
      this.deletingDeviceName = device.name
      this.$axios
        .$post(`/api/emails/ereader-devices`, payload)
        .then((data) => {
          this.ereaderDevicesUpdated(data.ereaderDevices)
        })
        .catch((error) => {
          console.error('Failed to delete device', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.deletingDeviceName = null
        })
    },
    ereaderDevicesUpdated(ereaderDevices) {
      this.settings.ereaderDevices = ereaderDevices
      this.newSettings.ereaderDevices = ereaderDevices.map((d) => ({ ...d }))

      // Load users if a device has availability set to specific users
      if (ereaderDevices.some((device) => device.availabilityOption === 'specificUsers')) {
        this.loadUsers()
      }
    },
    addNewDeviceClick() {
      this.selectedEReaderDevice = null
      this.showEReaderDeviceModal = true
    },
    sendTestClick() {
      this.sendingTest = true
      this.$axios
        .$post('/api/emails/test')
        .then(() => {
          this.$toast.success(this.$strings.ToastDeviceTestEmailSuccess)
        })
        .catch((error) => {
          console.error('Failed to send test email', error)
          const errorMsg = error.response.data || this.$strings.ToastDeviceTestEmailFailed
          this.$toast.error(errorMsg)
        })
        .finally(() => {
          this.sendingTest = false
        })
    },
    validateForm() {
      for (const ref of [this.$refs.hostInput, this.$refs.portInput, this.$refs.userInput, this.$refs.passInput, this.$refs.fromInput]) {
        if (ref?.blur) ref.blur()
      }

      if (this.newSettings.port) {
        this.newSettings.port = Number(this.newSettings.port)
      }

      return true
    },
    submitForm() {
      if (!this.validateForm()) return

      const updatePayload = {
        host: this.newSettings.host,
        port: this.newSettings.port,
        secure: this.newSettings.secure,
        rejectUnauthorized: this.newSettings.rejectUnauthorized,
        user: this.newSettings.user,
        pass: this.newSettings.pass,
        testAddress: this.newSettings.testAddress,
        fromAddress: this.newSettings.fromAddress
      }
      this.savingSettings = true
      this.$axios
        .$patch('/api/emails/settings', updatePayload)
        .then((data) => {
          this.settings = data.settings
          this.newSettings = {
            ...data.settings
          }
          this.$toast.success(this.$strings.ToastEmailSettingsUpdateSuccess)
        })
        .catch((error) => {
          console.error('Failed to update email settings', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.savingSettings = false
        })
    },
    init() {
      this.loading = true

      this.$axios
        .$get(`/api/emails/settings`)
        .then(async (data) => {
          // Load users if a device has availability set to specific users
          if (data.settings.ereaderDevices.some((device) => device.availabilityOption === 'specificUsers')) {
            await this.loadUsers()
          }

          this.settings = data.settings
          this.newSettings = {
            ...this.settings
          }
        })
        .catch((error) => {
          console.error('Failed to get email settings', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
        })
        .finally(() => {
          this.loading = false
        })
    }
  },
  mounted() {
    this.init()
  },
  beforeDestroy() {}
}
</script>
