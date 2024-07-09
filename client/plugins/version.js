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

export const currentVersion = packagejson.version

export async function checkForUpdate() {
  if (!packagejson.version) {
    return null
  }
  var currVerObj = parseSemver('v' + packagejson.version)
  if (!currVerObj) {
    console.error('Invalid version', packagejson.version)
    return null
  }
  var largestVer = null
  await axios.get(`https://api.github.com/repos/advplyr/audiobookshelf/releases`).then((res) => {
    var releases = res.data
    if (releases && releases.length) {
      releases.forEach((release) => {
        var tagName = release.tag_name
        var verObj = parseSemver(tagName)
        if (verObj) {
          if (!largestVer || largestVer.total < verObj.total) {
            largestVer = verObj
          }
        }

        if (verObj.version == currVerObj.version) {
          currVerObj.pubdate = new Date(release.published_at)
          currVerObj.changelog = release.body
        }
      })
    }
  })
  if (!largestVer) {
    console.error('No valid version tags to compare with')
    return null
  }

  return {
    hasUpdate: largestVer.total > currVerObj.total,
    latestVersion: largestVer.version,
    githubTagUrl: `https://github.com/advplyr/audiobookshelf/releases/tag/v${largestVer.version}`,
    currentVersion: currVerObj.version,
    currentTagUrl: `https://github.com/advplyr/audiobookshelf/releases/tag/v${currVerObj.version}`,
    currentVersionPubDate: currVerObj.pubdate,
    currentVersionChangelog: currVerObj.changelog
  }
}
