# AudioBookshelf

AudioBookshelf is a self-hosted audiobook server for managing and playing your audiobooks.

**Currently in Beta** - **Free & open source Android/iOS app is in development**

<img alt="Screenshot1" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_bookshelf.png" />


#### Folder Structures Supported:

```bash
/Title/...
/Author/Title/...
/Author/Series/Title/...

Title can start with the publish year like so:
/1989 - Awesome Book/...
```


#### There is still a lot to do:

* Adding new audiobooks require pressing Scan button again (on settings page)
* Matching is still manual - should auto-match when exact title and author with cover image is found
* Support different views to see more details of each audiobook
* Add ability to add/manage additional accounts with varying access levels
* Then comes the mobile app..

<img alt="Screenshot2" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_streaming.png" />

## Installation

Built to run in Docker for now (also on Unraid server Community Apps)

```bash
docker run -d -p 1337:80 -v /audiobooks:/audiobooks -v /config:/config -v /metadata:/metadata --name audiobookshelf --rm advplyr/audiobookshelf
```

<img alt="Screenshot3" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_audiobook.png" />

## Contributing

Feel free to help out