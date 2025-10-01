import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'

let tour = null

const tours = {
  appBar: [
    { id: 'home-button', text: 'Click here to return to the homepage.', attachTo: { element: '#appbar-home-icon', on: 'bottom' } },
    { id: 'library-icon', text: 'Click to select the library.', attachTo: { element: '#appbar-library-icon', on: 'bottom' } },
    { id: 'search-bar', text: 'Use this search bar to find any book.', attachTo: { element: '#appbar-search-bar', on: 'bottom' } },
    { id: 'stats-icon', text: 'View your stats here.', attachTo: { element: '#appbar-stats', on: 'bottom' } },
    { id: 'upload-button', text: 'Click here to upload a new audiobook.', attachTo: { element: '#appbar-upload-button', on: 'bottom' } },
    { id: 'settings-icon', text: 'Access your app settings here.', attachTo: { element: '#appbar-settings-icon', on: 'bottom' } },
    { id: 'account-link', text: 'Click here to access your account settings.', attachTo: { element: '#appbar-account-link', on: 'bottom' } },
    { id: 'sidebar-home', text: 'This is your homepage where you can see your recent activity.', attachTo: { element: '#sidebar-home', on: 'right' } },
    { id: 'sidebar-library', text: 'Access your entire audiobook library here.', attachTo: { element: '#sidebar-library', on: 'right' } },
    { id: 'sidebar-series', text: 'Quick access to your series.', attachTo: { element: '#sidebar-series', on: 'right' } },
    { id: 'sidebar-collection', text: 'View your books collection.', attachTo: { element: '#sidebar-collection', on: 'right' } },
    { id: 'sidebar-playlists', text: 'Manage your playlists from this section.', attachTo: { element: '#sidebar-playlists', on: 'right' } },
    { id: 'sidebar-authors', text: 'Manage your authors from this section.', attachTo: { element: '#sidebar-authors', on: 'right' } },
    { id: 'sidebar-narrators', text: 'View narrators and their books from this section.', attachTo: { element: '#sidebar-narrators', on: 'right' } },
    { id: 'sidebar-stats', text: 'This section will provide all the stats in audio book shelf.', attachTo: { element: '#sidebar-stats', on: 'right' } }
  ],
  libraryItem: [
    {
      id: 'item-cover',
      text: 'This is the book cover. Click to expand or edit.',
      attachTo: { element: '#covers-book-cover', on: 'right' },
      canClickTarget: false // stops Shepherd from triggering the click
    },
    {
      id: 'item-title',
      text: 'Here is the title and subtitle of the item.',
      attachTo: { element: '#book-title', on: 'right' }
    }
  ]
}

export function startTour(tourId = 'appBar') {
  if (!tours[tourId]) return console.warn('Tour not found:', tourId)

  tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      scrollTo: true,
      cancelIcon: { enabled: true },
      popperOptions: { modifiers: [{ name: 'preventOverflow', options: { boundary: 'viewport' } }] },
      classes: 'shadow-md bg-primary text-white',
      highlightClass: 'bg-secondary',
      container: 'body',
      when: {
        show() {
          requestAnimationFrame(() => {
            const content = this.el.querySelector('.shepherd-content') || this.el.querySelector('.shepherd-body')
            if (!content) return

            const existingWrapper = content.querySelector('.shepherd-extra-wrapper')
            if (existingWrapper) existingWrapper.remove()

            const wrapper = document.createElement('div')
            wrapper.className = 'shepherd-extra-wrapper'
            wrapper.style.display = 'flex'
            wrapper.style.flexDirection = 'column'
            wrapper.style.alignItems = 'center'
            wrapper.style.margin = '10px 0'

            // Progress bar
            const progress = document.createElement('div')
            progress.style.height = '6px'
            progress.style.width = '100%'
            progress.style.background = '#eee'
            progress.style.borderRadius = '3px'
            progress.style.marginBottom = '10px'

            const innerBar = document.createElement('span')
            innerBar.style.display = 'block'
            innerBar.style.height = '100%'
            innerBar.style.background = '#E4572E'
            innerBar.style.borderRadius = '3px'
            const currentStepIndex = tour.steps.indexOf(this) + 1
            innerBar.style.width = `${(currentStepIndex / tour.steps.length) * 100}%`

            progress.appendChild(innerBar)

            // Image slider
            const slider = document.createElement('div')
            slider.className = 'tour-image-slider'
            slider.style.position = 'relative'
            slider.style.width = '200px'
            slider.style.height = '120px'
            slider.style.overflow = 'hidden'
            slider.style.marginTop = '10px'

            // Correct public paths
            const images = ['/book_placeholder.jpg', '/images/step2.png', '/images/step3.png']
            let currentIndex = 0

            const imgEl = document.createElement('img')
            imgEl.src = images[currentIndex]
            imgEl.alt = 'Tour Image'
            imgEl.style.width = '100%'
            imgEl.style.height = '100%'
            imgEl.style.objectFit = 'contain'
            slider.appendChild(imgEl)

            // Prev button
            const prevBtn = document.createElement('button')
            prevBtn.textContent = '<'
            prevBtn.style.position = 'absolute'
            prevBtn.style.left = '5px'
            prevBtn.style.top = '50%'
            prevBtn.style.transform = 'translateY(-50%)'
            prevBtn.style.background = 'rgba(0,0,0,0.5)'
            prevBtn.style.color = '#fff'
            prevBtn.style.border = 'none'
            prevBtn.style.borderRadius = '50%'
            prevBtn.style.width = '25px'
            prevBtn.style.height = '25px'
            prevBtn.onclick = () => {
              currentIndex = (currentIndex - 1 + images.length) % images.length
              imgEl.src = images[currentIndex]
            }

            // Next button
            const nextBtn = document.createElement('button')
            nextBtn.textContent = '>'
            nextBtn.style.position = 'absolute'
            nextBtn.style.right = '5px'
            nextBtn.style.top = '50%'
            nextBtn.style.transform = 'translateY(-50%)'
            nextBtn.style.background = 'rgba(0,0,0,0.5)'
            nextBtn.style.color = '#fff'
            nextBtn.style.border = 'none'
            nextBtn.style.borderRadius = '50%'
            nextBtn.style.width = '25px'
            nextBtn.style.height = '25px'
            nextBtn.onclick = () => {
              currentIndex = (currentIndex + 1) % images.length
              imgEl.src = images[currentIndex]
            }

            slider.appendChild(prevBtn)
            slider.appendChild(nextBtn)

            // Add to wrapper
            wrapper.appendChild(progress)
            wrapper.appendChild(slider)

            const footer = content.querySelector('.shepherd-footer')
            if (footer) content.insertBefore(wrapper, footer)
            else content.appendChild(wrapper)
          })
        }
      }
    }
  })

  const addStepSafely = (step) => {
    const el = document.querySelector(step.attachTo?.element)
    if (!el) return false
    tour.addStep(step)
    return true
  }

  const steps = tours[tourId].map((step, idx) => {
    const stepWithButtons = { ...step, buttons: [] }
    if (idx > 0) stepWithButtons.buttons.push({ text: 'Back', action: () => tour.back() })
    stepWithButtons.buttons.push({
      text: idx === tours[tourId].length - 1 ? 'Done' : 'Next',
      action: idx === tours[tourId].length - 1 ? () => tour.complete() : () => tour.next()
    })
    return stepWithButtons
  })

  if (tourId === 'libraryItem') {
    // Wait for all elements to exist before adding steps and starting tour
    const interval = setInterval(() => {
      const allExist = steps.every((step) => document.querySelector(step.attachTo?.element))
      if (allExist) {
        steps.forEach((step) => tour.addStep(step))
        clearInterval(interval)
        tour.start()
      }
    }, 200)
  } else {
    // AppBar tour: add steps immediately
    steps.forEach((step) => tour.addStep(step))
    tour.start()
  }
}
