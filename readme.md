# AudioBookshelf

AudioBookshelf is a self-hosted audiobook server for managing and playing your audiobooks.

**Currently in early beta**

<img alt="Screenshot1" src="https://github.com/advplyr/audiobookshelf/raw/master/static/ss_bookshelf.png" />

Missing a lot of features still, like...

* Scanner is intended for file structure `[author name]/[title]/...`
* Adding new audiobooks require pressing Scan button again (on settings page)
* Matching is all manual now and only using 1 source (openlibrary)
* Need to add cover selection from match results
* Different views to see more details of each audiobook
* Mobile app will be next..

<img alt="Screenshot2" src="https://github.com/advplyr/audiobookshelf/raw/master/static/ss_streaming.png" />

## Installation

Built to run in Docker for now (also on Unraid server Community Apps)

```bash
docker run -d -p 1337:80 -v /audiobooks:/audiobooks -v /config:/config -v /metadata:/metadata --name audiobookshelf --rm advplyr/audiobookshelf
```

<img alt="Screenshot3" src="https://github.com/advplyr/audiobookshelf/raw/master/static/ss_audiobook.png" />

## Contributing

Feel free to help out