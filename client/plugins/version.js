import packagejson from '../package.json'
import axios from 'axios'

function parseSemver(ver) {
  if (!ver) return null
  var groups = ver.match(/^v((([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?)(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?)$/)
  if (groups && groups.length > 6) {
    var total = Number(groups[3]) * 100 + Number(groups[4]) * 10 + Number(groups[5])
    if (isNaN(total)) {
      console.warn('Invalid version total', groups[3], groups[4], groups[5])
      return null
    }
    return {
      total,
      version: groups[2],
      major: Number(groups[3]),
      minor: Number(groups[4]),
      patch: Number(groups[5]),
      preRelease: groups[6] || null
    }
  } else {
    console.warn('Invalid semver string', ver)
  }
  return null
}
export async function checkForUpdate() {
  if (!packagejson.version) {
    return
  }
  var currVerObj = parseSemver('v' + packagejson.version)
  if (!currVerObj) {
    console.error('Invalid version', packagejson.version)
    return
  }
  var largestVer = null
  await axios.get(`https://api.github.com/repos/advplyr/audiobookshelf/tags`).then((res) => {
    var tags = res.data
    if (tags && tags.length) {
      tags.forEach((tag) => {
        var verObj = parseSemver(tag.name)
        if (verObj) {
          if (!largestVer || largestVer.total < verObj.total) {
            largestVer = verObj
          }
        }
      })
    }
  })
  if (!largestVer) {
    console.error('No valid version tags to compare with')
    return
  }
  return {
    hasUpdate: largestVer.total > currVerObj.total,
    latestVersion: largestVer.version,
    githubTagUrl: `https://github.com/advplyr/audiobookshelf/releases/tag/v${largestVer.version}`,
    currentVersion: currVerObj.version
  }
}