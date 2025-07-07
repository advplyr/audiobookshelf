<template>
  <div>
    <ui-multi-select-query-input v-model="seriesItems" text-key="displayName" :label="$strings.LabelSeries" :disabled="disabled" readonly show-edit @edit="editSeriesItem" @add="addNewSeries" />

    <modals-edit-series-input-inner-modal v-model="showSeriesForm" :selected-series="selectedSeries" :existing-series-names="existingSeriesNames" :original-series-sequence="originalSeriesSequence" @submit="submitSeriesForm" />
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: Array,
      default: () => []
    },
    disabled: Boolean
  },
  data() {
    return {
      selectedSeries: null,
      originalSeriesSequence: null,
      showSeriesForm: false
    }
  },
  computed: {
    seriesItems: {
      get() {
        return (this.value || []).map((se) => {
          return {
            displayName: se.sequence ? `${se.name} #${se.sequence}` : se.name,
            ...se
          }
        })
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    series() {
      return this.filterData.series || []
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    },
    existingSeriesNames() {
      // Only show series names not already selected
      var alreadySelectedSeriesIds = (this.value || []).map((se) => se.id)
      return this.series.filter((se) => !alreadySelectedSeriesIds.includes(se.id)).map((se) => se.name)
    }
  },
  methods: {
    cancelSeriesForm() {
      this.showSeriesForm = false
    },
    editSeriesItem(series) {
      var _series = this.seriesItems.find((se) => se.id === series.id)
      if (!_series) return

      this.selectedSeries = {
        ..._series
      }

      this.originalSeriesSequence = _series.sequence
      this.showSeriesForm = true
    },
    addNewSeries() {
      this.selectedSeries = {
        id: `new-${Date.now()}`,
        name: '',
        sequence: ''
      }

      this.originalSeriesSequence = null
      this.showSeriesForm = true
    },
    submitSeriesForm() {
      if (!this.selectedSeries.name) {
        this.$toast.error('Must enter a series')
        return
      }

      var existingSeriesIndex = this.seriesItems.findIndex((se) => se.id === this.selectedSeries.id)

      var existingSeriesSameName = this.seriesItems.findIndex((se) => se.name.toLowerCase() === this.selectedSeries.name.toLowerCase())
      if (existingSeriesSameName >= 0 && existingSeriesIndex < 0) {
        console.error('Attempt to add duplicate series')
        this.$toast.error(this.$strings.ToastSeriesSubmitFailedSameName)
        return
      }

      var seriesSameName = this.series.find((se) => se.name.toLowerCase() === this.selectedSeries.name.toLowerCase())
      if (existingSeriesIndex < 0 && seriesSameName) {
        this.selectedSeries.id = seriesSameName.id
      }

      var selectedSeriesCopy = { ...this.selectedSeries }
      selectedSeriesCopy.displayName = selectedSeriesCopy.sequence ? `${selectedSeriesCopy.name} #${selectedSeriesCopy.sequence}` : selectedSeriesCopy.name

      var seriesCopy = this.seriesItems.map((v) => ({ ...v }))
      if (existingSeriesIndex >= 0) {
        seriesCopy.splice(existingSeriesIndex, 1, selectedSeriesCopy)
        this.seriesItems = seriesCopy
      } else {
        seriesCopy.push(selectedSeriesCopy)
        this.seriesItems = seriesCopy
      }

      this.showSeriesForm = false
    }
  }
}
</script>
