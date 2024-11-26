import packagejson from '../package.json'
import axios from 'axios'

function parseSemver(ver) {
  if (!ver) return null
  var groups = ver.match(/^v((([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?)(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?)$/)
  if (groups && groups.length > 6) {
    var total = Number(groups[3]) * 10000 + Number(groups[4]) * 100 + Number(groups[5])
    if (isNaN(total)) {
      console.warn('Invalid version total', groups[3], groups[4], groups[5])
      return null
    }
    return {
      name: ver,
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

function getReleases() {
  return axios
    .get(`https://api.github.com/repos/advplyr/audiobookshelf/releases`)
    .then((res) => {
      return res.data
        .map((release) => {
          const tagName = release.tag_name
          const verObj = parseSemver(tagName)
          if (verObj) {
            verObj.pubdate = new Date(release.published_at)
            verObj.changelog = release.body
            return verObj
          }
          return null
        })
        .filter((verObj) => verObj)
    })
    .catch((error) => {
      console.error('Failed to get releases', error)
      return []
    })
}

export const currentVersion = packagejson.version

export async function checkForUpdate() {
  if (!packagejson.version) {
    return null
  }

  const releases = await getReleases()
  if (!releases.length) {
    console.error('No releases found')
    return null
  }

  const currentVersion = releases.find((release) => release.version == packagejson.version)
  if (!currentVersion) {
    console.error('Current version not found in releases')
    return null
  }

  const latestVersion = releases[0]
  const currentVersionMinor = currentVersion.minor
  const currentVersionMajor = currentVersion.major
  // Show all releases with the same minor version and lower or equal total version
  const releasesToShow = releases.filter((release) => {
    return release.major == currentVersionMajor && release.minor == currentVersionMinor && release.total <= currentVersion.total
  })

  return {
    hasUpdate: latestVersion.total > currentVersion.total,
    latestVersion: latestVersion.version,
    githubTagUrl: `https://github.com/advplyr/audiobookshelf/releases/tag/v${latestVersion.version}`,
    currentVersion: currentVersion.version,
    releasesToShow
  }
}
