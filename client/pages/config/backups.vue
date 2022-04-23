<template>
  <div class="w-full h-full">
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
      <div class="flex items-center mb-2">
        <h1 class="text-xl">Backups</h1>
      </div>

      <p class="text-base mb-4 text-gray-300">Backups include users, user progress, book details, server settings and covers stored in <span class="font-mono text-gray-100">/metadata/items</span>. <br />Backups <strong>do not</strong> include any files stored in your library folders.</p>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="dailyBackups" small :disabled="updatingServerSettings" @input="updateBackupsSettings" />
        <ui-tooltip :text="dailyBackupsTooltip">
          <p class="pl-4 text-lg">Run daily backups <span class="material-icons icon-text">info_outlined</span></p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-text-input type="number" v-model="backupsToKeep" no-spinner :disabled="updatingServerSettings" :padding-x="1" text-center class="w-10" @change="updateBackupsSettings" />

        <p class="pl-4 text-lg">Number of backups to keep</p>
      </div>

      <div class="flex items-center py-2">
        <ui-text-input type="number" v-model="maxBackupSize" no-spinner :disabled="updatingServerSettings" :padding-x="1" text-center class="w-10" @change="updateBackupsSettings" />

        <p class="pl-4 text-lg">Maximum backup size (in GB)</p>
      </div>

      <tables-backups-table />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      updatingServerSettings: false,
      dailyBackups: true,
      backupsToKeep: 2,
      maxBackupSize: 1,
      newServerSettings: {}
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
    dailyBackupsTooltip() {
      return 'Runs at 1am every day (your server time). Saved in /metadata/backups.'
    },
    serverSettings() {
      return this.$store.state.serverSettings
    }
  },
  methods: {
    updateBackupsSettings() {
      if (isNaN(this.maxBackupSize) || this.maxBackupSize <= 0) {
        this.$toast.error('Invalid maximum backup size')
        return
      }
      if (isNaN(this.backupsToKeep) || this.backupsToKeep <= 0 || this.backupsToKeep > 99) {
        this.$toast.error('Invalid number of backups to keep')
        return
      }
      var updatePayload = {
        backupSchedule: this.dailyBackups ? '0 1 * * *' : false,
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
      this.dailyBackups = !!this.newServerSettings.backupSchedule
      this.maxBackupSize = this.newServerSettings.maxBackupSize || 1
    }
  },
  mounted() {
    this.initServerSettings()
  }
}
</script>