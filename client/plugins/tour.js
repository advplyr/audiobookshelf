// client/plugins/tour.js
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'

export default (context, inject) => {
  const defaultTourOptions = {
    defaultStepOptions: {
      cancelIcon: {
        enabled: true
      },
      scrollTo: { behavior: 'smooth', block: 'center' },
      classes: 'shadow-md bg-purple-dark text-white rounded p-3'
    },
    useModalOverlay: true
  }

  const createTour = (steps = []) => {
    const tour = new Shepherd.Tour(defaultTourOptions)
    steps.forEach((step) => tour.addStep(step))
    return tour
  }

  inject('createTour', createTour)
}
