import { state, mutations } from '../../../client/store/user.js'
import { expect } from 'chai'

describe('User Store Mutations', () => {
  let mockState

  beforeEach(() => {
    mockState = state()
    // Mock localStorage
    global.localStorage = {
      store: {},
      getItem(key) {
        return this.store[key] || null
      },
      setItem(key, value) {
        this.store[key] = value
      },
      removeItem(key) {
        delete this.store[key]
      }
    }
  })

  it('Default state has enableSmartSpeed = false', () => {
    expect(mockState.settings.enableSmartSpeed).to.be.false
  })

  it('Default state has smartSpeedRatio = 2.5', () => {
    expect(mockState.settings.smartSpeedRatio).to.equal(2.5)
  })

  it('SET_SMART_SPEED_ENABLED mutation toggles the value', () => {
    mutations.SET_SMART_SPEED_ENABLED(mockState)
    expect(mockState.settings.enableSmartSpeed).to.be.true
    mutations.SET_SMART_SPEED_ENABLED(mockState)
    expect(mockState.settings.enableSmartSpeed).to.be.false

    // Check setting explicitly
    mutations.SET_SMART_SPEED_ENABLED(mockState, true)
    expect(mockState.settings.enableSmartSpeed).to.be.true
  })

  it('SET_SMART_SPEED_RATIO mutation sets the value', () => {
    mutations.SET_SMART_SPEED_RATIO(mockState, 3.0)
    expect(mockState.settings.smartSpeedRatio).to.equal(3.0)
  })

  it('Ratio is clamped to valid range [1.5, 5.0]', () => {
    mutations.SET_SMART_SPEED_RATIO(mockState, 1.0)
    expect(mockState.settings.smartSpeedRatio).to.equal(1.5)

    mutations.SET_SMART_SPEED_RATIO(mockState, 6.0)
    expect(mockState.settings.smartSpeedRatio).to.equal(5.0)
  })

  it('Settings persist to localStorage', () => {
    mutations.SET_SMART_SPEED_ENABLED(mockState, true)
    let savedSettings = JSON.parse(localStorage.getItem('userSettings'))
    expect(savedSettings.enableSmartSpeed).to.be.true

    mutations.SET_SMART_SPEED_RATIO(mockState, 4.0)
    savedSettings = JSON.parse(localStorage.getItem('userSettings'))
    expect(savedSettings.smartSpeedRatio).to.equal(4.0)
  })
})
