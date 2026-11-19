const { expect } = require('chai')
const User = require('../../../server/models/User')
const ApiKey = require('../../../server/models/ApiKey')

describe('Podcast management permissions', () => {
  it('grants the default permission to admins only', () => {
    expect(User.getDefaultPermissionsForUserType('admin').addPodcasts).to.equal(true)
    expect(User.getDefaultPermissionsForUserType('user').addPodcasts).to.equal(false)
  })

  it('honors the permission for active users and always allows active admins', () => {
    const user = Object.create(User.prototype)
    Object.defineProperties(user, {
      type: { value: 'user', writable: true },
      isActive: { value: true, writable: true },
      permissions: { value: { addPodcasts: true }, writable: true }
    })
    expect(user.canAddPodcasts).to.equal(true)

    user.isActive = false
    expect(user.canAddPodcasts).to.equal(false)

    user.type = 'admin'
    user.isActive = true
    user.permissions.addPodcasts = false
    expect(user.canAddPodcasts).to.equal(true)
  })

  it('includes podcast adding in API key permission defaults', () => {
    expect(ApiKey.getDefaultPermissions().addPodcasts).to.equal(true)
  })
})
