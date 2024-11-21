import Vue from "vue"
import Toast from "vue-toastification"
import "vue-toastification/dist/index.css"

const options = {
  hideProgressBar: true,
  draggable: false
}

Vue.use(Toast, options)
