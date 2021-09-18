# AudioBookshelf

AudioBookshelf is a self-hosted audiobook server for managing and playing your audiobooks.

Android app is in beta, try it out on the [Google Play Store](https://play.google.com/store/apps/details?id=com.audiobookshelf.app)

**Free & open source Android/iOS app is in development**

<img alt="Screenshot1" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_streaming.png" />


## Directory Structure

Author, Series, Volume Number, Title and Publish Year can all be parsed from your folder structure.

**Note**: Files in the root directory `/audiobooks` will be ignored, all audiobooks should be in a directory

**1 Folder:** `/Title/...`\
**2 Folders:** `/Author/Title/...`\
**3 Folders:** `/Author/Series/Title/...`

### Parsing publish year

`/1984 - Hackers/...`\
Will save the publish year as `1984` and the title as `Hackers`

### Parsing volume number (only for series)

`/Book 3 - Hackers/...`\
Will save the volume number as `3` and the title as `Hackers`

`Book` `Volume` `Vol` `Vol.` are all supported case insensitive

These combinations will also work:\
`/Hackers - Vol. 3/...`\
`/1984 - Volume 3 - Hackers/...`\
`/1984 - Hackers Book 3/...`


### Parsing subtitles (optional in settings)

Title Folder: `/Hackers - Heroes of the Computer Revolution/...`

Will save the title as `Hackers` and the subtitle as `Heroes of the Computer Revolution`


### Full example

`/Steven Levy/The Hacker Series/1984 - Hackers - Heroes of the Computer Revolution - Vol. 1/...`

Becomes:\
| Key           | Value                             |
|---------------|-----------------------------------|
| Author        | Steven Levy                       |
| Series        | The Hacker Series                 |
| Publish Year  | 1984                              |
| Title         | Hackers                           |
| Subtitle      | Heroes of the Computer Revolution |
| Volume Number | 1                                 |


## Features coming soon

* Support different views to see more details of each audiobook
* iOS App (Android is in beta [here](https://play.google.com/store/apps/details?id=com.audiobookshelf.app))

## Installation

Built to run in Docker for now (also on Unraid server Community Apps)

```bash
docker run -d -p 1337:80 -v /audiobooks:/audiobooks -v /config:/config -v /metadata:/metadata --name audiobookshelf --rm advplyr/audiobookshelf
```

## Contributing

Feel free to help out