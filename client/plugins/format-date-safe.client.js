// Wrap app.$formatDate to accept ISO strings / numbers safely
import Vue from 'vue'
import { parseISO, isValid } from 'date-fns'
import format from 'date-fns/format'

export default ({ app }) => {
  const use = (impl) => (v, p) => {
    let d = v instanceof Date ? v : null
    if (!d && typeof v === 'string') {
      const k = parseISO(v)
      if (isValid(k)) d = k
    }
    if (!d && (typeof v === 'number' || typeof v === 'string')) {
      const k = new Date(v)
      if (isValid(k)) d = k
    }
    if (!d) return ''
    try {
      return impl(d, p)
    } catch {
      try {
        return format(d, p || 'yyyy-MM-dd')
      } catch {
        return ''
      }
    }
  }
  if (typeof app.$formatDate === 'function') {
    const safe = use((d, p) => app.$formatDate(d, p))
    app.$formatDate = safe
    Vue.prototype.$formatDate = safe
  } else {
    const safe = use((d, p) => format(d, p || 'yyyy-MM-dd'))
    app.$formatDate = safe
    Vue.prototype.$formatDate = safe
  }
}
