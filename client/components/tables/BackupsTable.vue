<template>
  <div class="text-center mt-4">
    <div class="flex py-4">
      <ui-file-input ref="fileInput" class="mr-2" accept=".audiobookshelf" @change="backupUploaded">Upload Backup</ui-file-input>
      <div class="flex-grow" />
      <ui-btn :loading="isBackingUp" @click="clickCreateBackup">Create Backup</ui-btn>
    </div>
    <div class="relative">
      <table id="backups">
        <tr>
          <th>File</th>
          <th class="hidden sm:table-cell w-32 md:w-56">Datetime</th>
          <th class="hidden sm:table-cell w-20 md:w-28">Size</th>
          <th class="w-36"></th>
        </tr>
        <tr v-for="backup in backups" :key="backup.id" :class="!backup.serverVersion ? 'bg-error bg-opacity-10' : ''">
          <td>
            <p class="truncate text-xs sm:text-sm md:text-base">/{{ backup.path.replace(/\\/g, '/') }}</p>
          </td>
          <td class="hidden sm:table-cell font-sans text-sm">{{ backup.datePretty }}</td>
          <td class="hidden sm:table-cell font-mono md:text-sm text-xs">{{ $bytesPretty(backup.fileSize) }}</td>
          <td>
            <div class="w-full flex flex-row items-center justify-center">
              <ui-btn v-if="backup.serverVersion" small color="primary" @click="applyBackup(backup)">Restore</ui-btn>

              <a v-if="backup.serverVersion" :href="`/metadata/${$encodeUriPath(backup.path)}?token=${userToken}`" class="mx-1 pt-1 hover:text-opacity-100 text-opacity-70 text-white" download><span class="material-icons text-xl">download</span></a>
              <ui-tooltip v-else text="This backup was created with an old version of audiobookshelf no longer supported" direction="bottom" class="mx-2 flex items-center">
                <span class="material-icons-outlined text-error">error_outline</span>
              </ui-tooltip>

              <span class="material-icons text-xl hover:text-error hover:text-opacity-100 text-opacity-70 text-white cursor-pointer mx-1" @click="deleteBackupClick(backup)">delete</span>
            </div>
          </td>
        </tr>
        <tr v-if="!backups.length" class="staticrow">
          <td colspan="4" class="text-lg">No Backups</td>
        </tr>
      </table>
      <div v-show="processing" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-25 flex items-center justify-center">
        <ui-loading-indicator />
      </div>
    </div>

    <prompt-dialog v-model="showConfirmApply" :width="675">
      <div v-if="selectedBackup" class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300">
        <p class="text-error text-lg font-semibold">Important Notice!</p>
        <p class="text-base py-1">Applying a backup will overwrite users, user progress, book details, settings, and covers stored in metadata with the backed up data.</p>
        <p class="text-base py-1">Backups <strong>do not</strong> modify any files in your library folders, only data in the audiobookshelf created <span class="font-mono">/config</span> and <span class="font-mono">/metadata</span> directories. If you have enabled server settings to store cover art and metadata in your library folders then those are not backed up or overwritten.</p>
        <p class="text-base py-1">All clients using your server will be automatically refreshed.</p>

        <p class="text-lg text-center my-8">Are you sure you want to apply the backup created on {{ selectedBackup.datePretty }}?</p>
        <div class="flex px-1 items-center">
          <ui-btn color="primary" @click="showConfirmApply = false">Nevermind</ui-btn>
          <div class="flex-grow" />
          <ui-btn color="success" @click="confirm">Apply Backup</ui-btn>
        </div>
      </div>
    </prompt-dialog>
  </div>
</template>

<script>
export default {
  data() {
    return {
      showConfirmApply: false,
      selectedBackup: null,
      isBackingUp: false,
      processing: false
    }
  },
  computed: {
    backups() {
      return this.$store.state.backups || []
    },
    userToken() {
      return this.$store.getters['user/getToken']
    }
  },
  methods: {
    confirm() {
      this.showConfirmApply = false

      this.$axios
        .$get(`/api/backups/${this.selectedBackup.id}/apply`)
        .then(() => {
          this.isBackingUp = false
          location.replace('/config/backups?backup=1')
        })
        .catch((error) => {
          this.isBackingUp = false
          console.error('Failed', error)
          this.$toast.error('Failed to apply backup')
        })
    },
    deleteBackupClick(backup) {
      if (confirm(`Are you sure you want to delete backup for ${backup.datePretty}?`)) {
        this.processing = true
        this.$axios
          .$delete(`/api/backups/${backup.id}`)
          .then((backups) => {
            console.log('Backup deleted', backups)
            this.$store.commit('setBackups', backups)
            this.$toast.success(`Backup deleted`)
            this.processing = false
          })
          .catch((error) => {
            console.error(error)
            this.$toast.error('Failed to delete backup')
            this.processing = false
          })
      }
    },
    applyBackup(backup) {
      this.selectedBackup = backup
      this.showConfirmApply = true
    },
    clickCreateBackup() {
      this.isBackingUp = true
      this.$axios
        .$post('/api/backups')
        .then((backups) => {
          this.isBackingUp = false
          this.$toast.success('Backup Successful')
          this.$store.commit('setBackups', backups)
        })
        .catch((error) => {
          this.isBackingUp = false
          console.error('Failed', error)
          this.$toast.error('Backup Failed')
        })
    },
    backupUploaded(file) {
      var form = new FormData()
      form.set('file', file)

      this.processing = true

      this.$axios
        .$post('/api/backups/upload', form)
        .then((result) => {
          console.log('Upload backup result', result)
          this.$store.commit('setBackups', result)
          this.$toast.success('Backup upload success')
          this.processing = false
        })
        .catch((error) => {
          console.error(error)
          var errorMessage = error.response && error.response.data ? error.response.data : 'Failed to upload backup'
          this.$toast.error(errorMessage)
          this.processing = false
        })
    }
  },
  mounted() {
    if (this.$route.query.backup) {
      this.$toast.success('Backup applied successfully')
      this.$router.replace('/config')
    }
  }
}
</script>

<style>
#backups {
  table-layout: fixed;
  border-collapse: collapse;
  width: 100%;
}

#backups td,
#backups th {
  border: 1px solid #2e2e2e;
  padding: 8px 8px;
  text-align: left;
}

#backups tr.staticrow td {
  text-align: center;
}

#backups tr:nth-child(even):not(.bg-error) {
  background-color: #3a3a3a;
}

#backups tr:not(.staticrow):not(.bg-error):hover {
  background-color: #444;
}

#backups th {
  font-size: 0.8rem;
  font-weight: 600;
  padding-top: 5px;
  padding-bottom: 5px;
  background-color: #333;
}
</style>