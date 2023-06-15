<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderUsers" show-add-button @clicked="setShowUserModal">
      <tables-users-table />
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
      showAccountModal: false
    }
  },
  computed: {},
  methods: {
    setShowUserModal(selectedAccount) {
      this.selectedAccount = selectedAccount
      this.showAccountModal = true
    }
  },
  mounted() {}
}
</script>