# AudioBookshelf

AudioBookshelf is a self-hosted audiobook server for managing and playing your audiobooks.

**Currently in early beta**

<img alt="Screenshot1" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_bookshelf.png" />

Folder Structures Supported:

* `/[TITLE]/...`
* `/[AUTHOR]/[TITLE]/...`
* `/[AUTHOR]/[SERIES]/[TITLE]/...`
* Title can start with a year and hyphen like, "1989 - Book Title Here", which will use 1989 as the publish year.


Missing a lot of features still, like...

* Adding new audiobooks require pressing Scan button again (on settings page)
* Matching is all manual now and only using 1 source (openlibrary)
* Need to add cover selection from match results
* Different views to see more details of each audiobook
* Mobile app will be next..

<img alt="Screenshot2" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_streaming.png" />

## Installation

Built to run in Docker for now (also on Unraid server Community Apps)

```bash
docker run -d -p 1337:80 -v /audiobooks:/audiobooks -v /config:/config -v /metadata:/metadata --name audiobookshelf --rm advplyr/audiobookshelf
```

<img alt="Screenshot3" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_audiobook.png" />

## Contributing

Feel free to help out