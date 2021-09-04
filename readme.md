# AudioBookshelf

AudioBookshelf is a self-hosted audiobook server for managing and playing your audiobooks.

Android app is in beta, try it out on the [Google Play Store](https://play.google.com/store/apps/details?id=com.audiobookshelf.app)

**Free & open source Android/iOS app is in development**

<img alt="Screenshot1" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_streaming.png" />


#### Folder Structures Supported:

```bash
/Title/...
/Author/Title/...
/Author/Series/Title/...

Title can start with the publish year like so:
/1989 - Awesome Book/...
```


#### Features coming soon:

* Auto add and update audiobooks (currently you need to press scan)
* User permissions & editing users
* Support different views to see more details of each audiobook
* Option to download all files in a zip file
* iOS App (Android is in beta [here](https://play.google.com/store/apps/details?id=com.audiobookshelf.app))

<img alt="Screenshot2" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_audiobook.png" />

## Installation

Built to run in Docker for now (also on Unraid server Community Apps)

```bash
docker run -d -p 1337:80 -v /audiobooks:/audiobooks -v /config:/config -v /metadata:/metadata --name audiobookshelf --rm advplyr/audiobookshelf
```

## Contributing

Feel free to help out