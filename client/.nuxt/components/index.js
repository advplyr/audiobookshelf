import { wrapFunctional } from './utils'

export { default as AudioPlayer } from '../..\\components\\AudioPlayer.vue'
export { default as AppAppbar } from '../..\\components\\app\\Appbar.vue'
export { default as AppBookShelf } from '../..\\components\\app\\BookShelf.vue'
export { default as AppBookShelfToolbar } from '../..\\components\\app\\BookShelfToolbar.vue'
export { default as AppStreamContainer } from '../..\\components\\app\\StreamContainer.vue'
export { default as CardsBookCard } from '../..\\components\\cards\\BookCard.vue'
export { default as CardsBookCover } from '../..\\components\\cards\\BookCover.vue'
export { default as ControlsFilterSelect } from '../..\\components\\controls\\FilterSelect.vue'
export { default as ControlsOrderSelect } from '../..\\components\\controls\\OrderSelect.vue'
export { default as ControlsVolumeControl } from '../..\\components\\controls\\VolumeControl.vue'
export { default as ModalsEditModal } from '../..\\components\\modals\\EditModal.vue'
export { default as ModalsModal } from '../..\\components\\modals\\Modal.vue'
export { default as TablesAudioFilesTable } from '../..\\components\\tables\\AudioFilesTable.vue'
export { default as TablesOtherFilesTable } from '../..\\components\\tables\\OtherFilesTable.vue'
export { default as TablesTracksTable } from '../..\\components\\tables\\TracksTable.vue'
export { default as UiBtn } from '../..\\components\\ui\\Btn.vue'
export { default as UiLoadingIndicator } from '../..\\components\\ui\\LoadingIndicator.vue'
export { default as UiMenu } from '../..\\components\\ui\\Menu.vue'
export { default as UiTextareaInput } from '../..\\components\\ui\\TextareaInput.vue'
export { default as UiTextareaWithLabel } from '../..\\components\\ui\\TextareaWithLabel.vue'
export { default as UiTextInput } from '../..\\components\\ui\\TextInput.vue'
export { default as UiTextInputWithLabel } from '../..\\components\\ui\\TextInputWithLabel.vue'
export { default as UiTooltip } from '../..\\components\\ui\\Tooltip.vue'
export { default as WidgetsScanAlert } from '../..\\components\\widgets\\ScanAlert.vue'
export { default as ModalsEditTabsCover } from '../..\\components\\modals\\edit-tabs\\Cover.vue'
export { default as ModalsEditTabsDetails } from '../..\\components\\modals\\edit-tabs\\Details.vue'
export { default as ModalsEditTabsMatch } from '../..\\components\\modals\\edit-tabs\\Match.vue'
export { default as ModalsEditTabsTracks } from '../..\\components\\modals\\edit-tabs\\Tracks.vue'

export const LazyAudioPlayer = import('../..\\components\\AudioPlayer.vue' /* webpackChunkName: "components/audio-player" */).then(c => wrapFunctional(c.default || c))
export const LazyAppAppbar = import('../..\\components\\app\\Appbar.vue' /* webpackChunkName: "components/app-appbar" */).then(c => wrapFunctional(c.default || c))
export const LazyAppBookShelf = import('../..\\components\\app\\BookShelf.vue' /* webpackChunkName: "components/app-book-shelf" */).then(c => wrapFunctional(c.default || c))
export const LazyAppBookShelfToolbar = import('../..\\components\\app\\BookShelfToolbar.vue' /* webpackChunkName: "components/app-book-shelf-toolbar" */).then(c => wrapFunctional(c.default || c))
export const LazyAppStreamContainer = import('../..\\components\\app\\StreamContainer.vue' /* webpackChunkName: "components/app-stream-container" */).then(c => wrapFunctional(c.default || c))
export const LazyCardsBookCard = import('../..\\components\\cards\\BookCard.vue' /* webpackChunkName: "components/cards-book-card" */).then(c => wrapFunctional(c.default || c))
export const LazyCardsBookCover = import('../..\\components\\cards\\BookCover.vue' /* webpackChunkName: "components/cards-book-cover" */).then(c => wrapFunctional(c.default || c))
export const LazyControlsFilterSelect = import('../..\\components\\controls\\FilterSelect.vue' /* webpackChunkName: "components/controls-filter-select" */).then(c => wrapFunctional(c.default || c))
export const LazyControlsOrderSelect = import('../..\\components\\controls\\OrderSelect.vue' /* webpackChunkName: "components/controls-order-select" */).then(c => wrapFunctional(c.default || c))
export const LazyControlsVolumeControl = import('../..\\components\\controls\\VolumeControl.vue' /* webpackChunkName: "components/controls-volume-control" */).then(c => wrapFunctional(c.default || c))
export const LazyModalsEditModal = import('../..\\components\\modals\\EditModal.vue' /* webpackChunkName: "components/modals-edit-modal" */).then(c => wrapFunctional(c.default || c))
export const LazyModalsModal = import('../..\\components\\modals\\Modal.vue' /* webpackChunkName: "components/modals-modal" */).then(c => wrapFunctional(c.default || c))
export const LazyTablesAudioFilesTable = import('../..\\components\\tables\\AudioFilesTable.vue' /* webpackChunkName: "components/tables-audio-files-table" */).then(c => wrapFunctional(c.default || c))
export const LazyTablesOtherFilesTable = import('../..\\components\\tables\\OtherFilesTable.vue' /* webpackChunkName: "components/tables-other-files-table" */).then(c => wrapFunctional(c.default || c))
export const LazyTablesTracksTable = import('../..\\components\\tables\\TracksTable.vue' /* webpackChunkName: "components/tables-tracks-table" */).then(c => wrapFunctional(c.default || c))
export const LazyUiBtn = import('../..\\components\\ui\\Btn.vue' /* webpackChunkName: "components/ui-btn" */).then(c => wrapFunctional(c.default || c))
export const LazyUiLoadingIndicator = import('../..\\components\\ui\\LoadingIndicator.vue' /* webpackChunkName: "components/ui-loading-indicator" */).then(c => wrapFunctional(c.default || c))
export const LazyUiMenu = import('../..\\components\\ui\\Menu.vue' /* webpackChunkName: "components/ui-menu" */).then(c => wrapFunctional(c.default || c))
export const LazyUiTextareaInput = import('../..\\components\\ui\\TextareaInput.vue' /* webpackChunkName: "components/ui-textarea-input" */).then(c => wrapFunctional(c.default || c))
export const LazyUiTextareaWithLabel = import('../..\\components\\ui\\TextareaWithLabel.vue' /* webpackChunkName: "components/ui-textarea-with-label" */).then(c => wrapFunctional(c.default || c))
export const LazyUiTextInput = import('../..\\components\\ui\\TextInput.vue' /* webpackChunkName: "components/ui-text-input" */).then(c => wrapFunctional(c.default || c))
export const LazyUiTextInputWithLabel = import('../..\\components\\ui\\TextInputWithLabel.vue' /* webpackChunkName: "components/ui-text-input-with-label" */).then(c => wrapFunctional(c.default || c))
export const LazyUiTooltip = import('../..\\components\\ui\\Tooltip.vue' /* webpackChunkName: "components/ui-tooltip" */).then(c => wrapFunctional(c.default || c))
export const LazyWidgetsScanAlert = import('../..\\components\\widgets\\ScanAlert.vue' /* webpackChunkName: "components/widgets-scan-alert" */).then(c => wrapFunctional(c.default || c))
export const LazyModalsEditTabsCover = import('../..\\components\\modals\\edit-tabs\\Cover.vue' /* webpackChunkName: "components/modals-edit-tabs-cover" */).then(c => wrapFunctional(c.default || c))
export const LazyModalsEditTabsDetails = import('../..\\components\\modals\\edit-tabs\\Details.vue' /* webpackChunkName: "components/modals-edit-tabs-details" */).then(c => wrapFunctional(c.default || c))
export const LazyModalsEditTabsMatch = import('../..\\components\\modals\\edit-tabs\\Match.vue' /* webpackChunkName: "components/modals-edit-tabs-match" */).then(c => wrapFunctional(c.default || c))
export const LazyModalsEditTabsTracks = import('../..\\components\\modals\\edit-tabs\\Tracks.vue' /* webpackChunkName: "components/modals-edit-tabs-tracks" */).then(c => wrapFunctional(c.default || c))
