<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderUsers">
      <template #header-items>
        <div v-if="numUsers" class="mx-2 px-1.5 rounded-lg bg-primary/50 text-gray-300/90 text-sm inline-flex items-center justify-center">
          <span>{{ numUsers }}</span>
        </div>

        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides/users" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>

        <div class="grow" />

        <ui-btn color="bg-primary" small @click="setShowUserModal()">{{ $strings.ButtonAddUser }}</ui-btn>
      </template>

      <tables-users-table class="pt-2" @edit="setShowUserModal" @numUsers="(count) => (numUsers = count)" />
    </app-settings-content>
    <modals-account-modal ref="accountModal" v-model="showAccountModal" :account="selectedAccount" />
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
      selectedAccount: null,
      showAccountModal: false,
      numUsers: 0
    }
  },
  computed: {},
  methods: {
    setShowUserModal(selectedAccount) {
      this.selectedAccount = selectedAccount
      this.showAccountModal = true
    }
  },
  mounted() {},
  beforeDestroy() {
    if (this.$refs.accountModal) {
      this.$refs.accountModal.close()
    }
  }
}
</script>
