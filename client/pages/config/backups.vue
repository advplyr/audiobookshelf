<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderBackups" :description="$strings.MessageBackupsDescription">
      <div v-if="backupLocation" class="mb-4 max-w-full overflow-hidden">
        <div class="flex items-center mb-0.5">
          <span class="material-symbols text-2xl text-black-50 mr-2">folder</span>
          <span class="text-white text-opacity-60 uppercase text-sm whitespace-nowrap">{{ $strings.LabelBackupLocation }}:</span>
        </div>
        <div v-if="!showEditBackupPath" class="inline-flex items-center w-full overflow-hidden">
          <p class="text-gray-100 max-w-[calc(100%-40px)] text-sm sm:text-base break-words">{{ backupLocation }}</p>
          <div class="w-10 min-w-10 flex items-center justify-center">
            <button class="text-black-50 hover:text-yellow-500 inline-flex" type="button" @click="showEditBackupPath = !showEditBackupPath">
              <span class="material-symbols text-lg">edit</span>
            </button>
          </div>
        </div>
        <div v-else>
          <form class="flex items-center w-full space-x-1" @submit.prevent="saveBackupPath">
            <ui-text-input v-model="newBackupLocation" :disabled="savingBackupPath || !canEditBackup" class="w-full max-w-[calc(100%-50px)] text-sm h-8" />
            <ui-btn v-if="canEditBackup" small :loading="savingBackupPath" color="success" type="submit" class="h-8">{{ $strings.ButtonSave }}</ui-btn>
            <ui-btn small :disabled="savingBackupPath" type="button" class="h-8" @click="cancelEditBackupPath">{{ $strings.ButtonCancel }}</ui-btn>
          </form>
          <p class="text-sm text-warning/80 pt-1">{{ canEditBackup ? $strings.MessageBackupsLocationEditNote : $strings.MessageBackupsLocationNoEditNote }}</p>
        </div>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="enableBackups" small :disabled="updatingServerSettings" @input="updateBackupsSettings" />
        <ui-tooltip :text="$strings.LabelBackupsEnableAutomaticBackupsHelp">
          <p class="pl-4 text-lg">{{ $strings.LabelBackupsEnableAutomaticBackups }} <span class="material-symbols icon-text">info</span></p>
        </ui-tooltip>
      </div>

      <div v-if="enableBackups" class="mb-6">
        <div class="flex items-center pl-0 sm:pl-6 mb-2">
          <span class="material-symbols text-xl sm:text-2xl text-black-50 mr-2">schedule</span>
          <div class="w-32 min-w-32 sm:w-40 sm:min-w-40">
            <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.HeaderSchedule }}:</span>
          </div>
          <div class="text-gray-100 text-sm sm:text-base">{{ scheduleDescription }}</div>
          <button class="ml-2 text-black-50 hover:text-yellow-500 inline-flex" type="button" @click="showCronBuilder = !showCronBuilder">
            <span class="material-symbols text-lg">edit</span>
          </button>
        </div>

        <div v-if="nextBackupDate" class="flex items-center pl-0 sm:pl-6 py-0.5">
          <span class="material-symbols text-xl sm:text-2xl text-black-50 mr-2">event</span>
          <div class="w-32 min-w-32 sm:w-40 sm:min-w-40">
            <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelNextBackupDate }}:</span>
          </div>
          <div class="text-gray-100 text-sm sm:text-base">{{ nextBackupDate }}</div>
        </div>
      </div>

      <div class="flex items-center py-2">
        <ui-text-input type="number" v-model="backupsToKeep" no-spinner :disabled="updatingServerSettings" :padding-x="1" text-center class="w-10" @change="updateBackupsSettings" />

        <ui-tooltip :text="$strings.LabelBackupsNumberToKeepHelp">
          <p class="pl-4 text-lg">{{ $strings.LabelBackupsNumberToKeep }} <span class="material-symbols icon-text">info</span></p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-text-input type="number" v-model="maxBackupSize" no-spinner :disabled="updatingServerSettings" :padding-x="1" text-center class="w-10" @change="updateBackupsSettings" />

        <ui-tooltip :text="$strings.LabelBackupsMaxBackupSizeHelp">
          <p class="pl-4 text-lg">{{ $strings.LabelBackupsMaxBackupSize }} <span class="material-symbols icon-text">info</span></p>
        </ui-tooltip>
      </div>

      <tables-backups-table ref="backupsTable" @loaded="backupsLoaded" />

      <modals-backup-schedule-modal v-model="showCronBuilder" :cron-expression.sync="cronExpression" />
    </app-settings-content>
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
      updatingServerSettings: false,
      enableBackups: true,
      backupsToKeep: 2,
      maxBackupSize: 1,
      cronExpression: '',
      newServerSettings: {},
      showCronBuilder: false,
      showEditBackupPath: false,
      backupPathEnvSet: false,
      backupLocation: '',
      newBackupLocation: '',
      savingBackupPath: false
    }
  },
  watch: {
    serverSettings(newVal, oldVal) {
      if (newVal && !oldVal) {
        this.newServerSettings = { ...this.serverSettings }
        this.initServerSettings()
      }
    }
  },
  computed: {
    serverSettings() {
      return this.$store.state.serverSettings
    },
    dateFormat() {
      return this.serverSettings.dateFormat
    },
    timeFormat() {
      return this.serverSettings.timeFormat
    },
    canEditBackup() {
      // Prevent editing of backup path if an environment variable is set
      return !this.backupPathEnvSet
    },
    scheduleDescription() {
      if (!this.cronExpression) return ''
      const parsed = this.$parseCronExpression(this.cronExpression)
      return parsed ? parsed.description : `${this.$strings.LabelCustomCronExpression} ${this.cronExpression}`
    },
    nextBackupDate() {
      if (!this.cronExpression) return ''
      const parsed = this.$getNextScheduledDate(this.cronExpression)
      return this.$formatJsDatetime(parsed, this.dateFormat, this.timeFormat) || ''
    }
  },
  methods: {
    backupsLoaded(data) {
      this.backupLocation = data.backupLocation
      this.newBackupLocation = data.backupLocation
      this.backupPathEnvSet = data.backupPathEnvSet
    },
    cancelEditBackupPath() {
      this.newBackupLocation = this.backupLocation
      this.showEditBackupPath = false
    },
    saveBackupPath() {
      if (!this.newBackupLocation?.trim()) {
        this.$toast.error(this.$strings.MessageBackupsLocationPathEmpty)
        return
      }
      this.newBackupLocation = this.newBackupLocation.trim()
      if (this.newBackupLocation === this.backupLocation) {
        this.showEditBackupPath = false
        return
      }

      this.savingBackupPath = true
      this.$axios
        .patch('/api/backups/path', { path: this.newBackupLocation })
        .then(() => {
          this.backupLocation = this.newBackupLocation
          this.showEditBackupPath = false
          this.$refs.backupsTable.loadBackups()
        })
        .catch((error) => {
          console.error('Failed to save backup path', error)
          const errorMsg = error.response?.data || this.$strings.ToastFailedToUpdate
          this.$toast.error(errorMsg)
        })
        .finally(() => {
          this.savingBackupPath = false
        })
    },
    updateBackupsSettings() {
      if (isNaN(this.maxBackupSize) || this.maxBackupSize < 0) {
        this.$toast.error(this.$strings.ToastBackupInvalidMaxSize)
        return
      }
      if (isNaN(this.backupsToKeep) || this.backupsToKeep <= 0 || this.backupsToKeep > 99) {
        this.$toast.error(this.$strings.ToastBackupInvalidMaxKeep)
        return
      }
      const updatePayload = {
        backupSchedule: this.enableBackups ? this.cronExpression : false,
        backupsToKeep: Number(this.backupsToKeep),
        maxBackupSize: Number(this.maxBackupSize)
      }
      this.updateServerSettings(updatePayload)
    },
    updateServerSettings(payload) {
      this.updatingServerSettings = true
      this.$store
        .dispatch('updateServerSettings', payload)
        .then((success) => {
          console.log('Updated Server Settings', success)
          this.updatingServerSettings = false
        })
        .catch((error) => {
          console.error('Failed to update server settings', error)
          this.updatingServerSettings = false
        })
    },
    initServerSettings() {
      this.newServerSettings = this.serverSettings ? { ...this.serverSettings } : {}
      this.backupsToKeep = this.newServerSettings.backupsToKeep || 2
      this.enableBackups = !!this.newServerSettings.backupSchedule
      this.maxBackupSize = this.newServerSettings.maxBackupSize === 0 ? 0 : this.newServerSettings.maxBackupSize || 1
      this.cronExpression = this.newServerSettings.backupSchedule || '30 1 * * *'
    }
  },
  mounted() {
    this.initServerSettings()
  }
}
</script>
