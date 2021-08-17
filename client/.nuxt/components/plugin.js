import Vue from 'vue'
import { wrapFunctional } from './utils'

const components = {
  AudioPlayer: () => import('../..\\components\\AudioPlayer.vue' /* webpackChunkName: "components/audio-player" */).then(c => wrapFunctional(c.default || c)),
  AppAppbar: () => import('../..\\components\\app\\Appbar.vue' /* webpackChunkName: "components/app-appbar" */).then(c => wrapFunctional(c.default || c)),
  AppBookShelf: () => import('../..\\components\\app\\BookShelf.vue' /* webpackChunkName: "components/app-book-shelf" */).then(c => wrapFunctional(c.default || c)),
  AppStreamContainer: () => import('../..\\components\\app\\StreamContainer.vue' /* webpackChunkName: "components/app-stream-container" */).then(c => wrapFunctional(c.default || c)),
  AppTracksTable: () => import('../..\\components\\app\\TracksTable.vue' /* webpackChunkName: "components/app-tracks-table" */).then(c => wrapFunctional(c.default || c)),
  CardsBookCard: () => import('../..\\components\\cards\\BookCard.vue' /* webpackChunkName: "components/cards-book-card" */).then(c => wrapFunctional(c.default || c)),
  CardsBookCover: () => import('../..\\components\\cards\\BookCover.vue' /* webpackChunkName: "components/cards-book-cover" */).then(c => wrapFunctional(c.default || c)),
  ControlsVolumeControl: () => import('../..\\components\\controls\\VolumeControl.vue' /* webpackChunkName: "components/controls-volume-control" */).then(c => wrapFunctional(c.default || c)),
  ModalsEditModal: () => import('../..\\components\\modals\\EditModal.vue' /* webpackChunkName: "components/modals-edit-modal" */).then(c => wrapFunctional(c.default || c)),
  ModalsModal: () => import('../..\\components\\modals\\Modal.vue' /* webpackChunkName: "components/modals-modal" */).then(c => wrapFunctional(c.default || c)),
  UiBtn: () => import('../..\\components\\ui\\Btn.vue' /* webpackChunkName: "components/ui-btn" */).then(c => wrapFunctional(c.default || c)),
  UiLoadingIndicator: () => import('../..\\components\\ui\\LoadingIndicator.vue' /* webpackChunkName: "components/ui-loading-indicator" */).then(c => wrapFunctional(c.default || c)),
  UiMenu: () => import('../..\\components\\ui\\Menu.vue' /* webpackChunkName: "components/ui-menu" */).then(c => wrapFunctional(c.default || c)),
  UiTextareaInput: () => import('../..\\components\\ui\\TextareaInput.vue' /* webpackChunkName: "components/ui-textarea-input" */).then(c => wrapFunctional(c.default || c)),
  UiTextareaWithLabel: () => import('../..\\components\\ui\\TextareaWithLabel.vue' /* webpackChunkName: "components/ui-textarea-with-label" */).then(c => wrapFunctional(c.default || c)),
  UiTextInput: () => import('../..\\components\\ui\\TextInput.vue' /* webpackChunkName: "components/ui-text-input" */).then(c => wrapFunctional(c.default || c)),
  UiTextInputWithLabel: () => import('../..\\components\\ui\\TextInputWithLabel.vue' /* webpackChunkName: "components/ui-text-input-with-label" */).then(c => wrapFunctional(c.default || c)),
  UiTooltip: () => import('../..\\components\\ui\\Tooltip.vue' /* webpackChunkName: "components/ui-tooltip" */).then(c => wrapFunctional(c.default || c)),
  WidgetsScanAlert: () => import('../..\\components\\widgets\\ScanAlert.vue' /* webpackChunkName: "components/widgets-scan-alert" */).then(c => wrapFunctional(c.default || c)),
  ModalsEditTabsCover: () => import('../..\\components\\modals\\edit-tabs\\Cover.vue' /* webpackChunkName: "components/modals-edit-tabs-cover" */).then(c => wrapFunctional(c.default || c)),
  ModalsEditTabsDetails: () => import('../..\\components\\modals\\edit-tabs\\Details.vue' /* webpackChunkName: "components/modals-edit-tabs-details" */).then(c => wrapFunctional(c.default || c)),
  ModalsEditTabsMatch: () => import('../..\\components\\modals\\edit-tabs\\Match.vue' /* webpackChunkName: "components/modals-edit-tabs-match" */).then(c => wrapFunctional(c.default || c)),
  ModalsEditTabsTracks: () => import('../..\\components\\modals\\edit-tabs\\Tracks.vue' /* webpackChunkName: "components/modals-edit-tabs-tracks" */).then(c => wrapFunctional(c.default || c))
}

for (const name in components) {
  Vue.component(name, components[name])
  Vue.component('Lazy' + name, components[name])
}
