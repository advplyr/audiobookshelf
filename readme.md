# AudioBookshelf

AudioBookshelf is a self-hosted audiobook server for managing and playing your audiobooks.

See [Install guides](https://audiobookshelf.org/install) and [documentation](https://audiobookshelf.org/docs)

Android app is in beta, try it out on the [Google Play Store](https://play.google.com/store/apps/details?id=com.audiobookshelf.app)

**Free & open source Android/iOS app is in development**

<img alt="Screenshot1" src="https://github.com/advplyr/audiobookshelf/raw/master/images/ss_streaming.png" />


## Directory Structure

 See [documentation](https://audiobookshelf.org/docs) for directory structure and naming.

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

**Becomes:**
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

### Docker Install
Available in Unraid Community Apps

```bash
docker pull advplyr/audiobookshelf

docker run -d \
  -p 1337:80 \
  -v </path/to/audiobooks>:/audiobooks \
  -v </path/to/config>:/config \
  -v </path/to/metadata>:/metadata \
  --name audiobookshelf \
  --rm advplyr/audiobookshelf
```

### Linux (amd64) Install

A simple installer is added to setup the initial config. If you already have audiobooks, you can enter the path to your audiobooks during the install. The installer will create a user and group named `audiobookshelf`.



### Ubuntu Install via PPA

A PPA is hosted on [github](https://github.com/advplyr/audiobookshelf-ppa), add and install:

```bash
curl -s --compressed "https://advplyr.github.io/audiobookshelf-ppa/KEY.gpg" | sudo apt-key add - 

sudo curl -s --compressed -o /etc/apt/sources.list.d/audiobookshelf.list "https://advplyr.github.io/audiobookshelf-ppa/audiobookshelf.list" 

sudo apt update 

sudo apt install audiobookshelf
```

or use a single command

```bash
curl -s --compressed "https://advplyr.github.io/audiobookshelf-ppa/KEY.gpg" | sudo apt-key add - && sudo curl -s --compressed -o /etc/apt/sources.list.d/audiobookshelf.list "https://advplyr.github.io/audiobookshelf-ppa/audiobookshelf.list" && sudo apt update && sudo apt install audiobookshelf
```

### Install via debian package

Get the `deb` file from the [github repo](https://github.com/advplyr/audiobookshelf-ppa).

```bash
wget https://advplyr.github.io/audiobookshelf-ppa/audiobookshelf_1.2.3_amd64.deb

sudo apt install ./audiobookshelf_1.2.3_amd64.deb
```


#### File locations

Project directory: `/usr/share/audiobookshelf/`

Config file: `/etc/default/audiobookshelf`

System Service: `/lib/systemd/system/audiobookshelf.service`

Ffmpeg static build: `/usr/lib/audiobookshelf-ffmpeg/`

## Run from source

Note: you will need `npm`, `node12`, and `ffmpeg` to run this project locally

```bash
git clone https://github.com/advplyr/audiobookshelf.git
cd audiobookshelf

# All paths default to root directory. Config path is the database.
# Directories will be created if they don't exist
# Paths are relative to the root directory, so "../Audiobooks" would be a valid path
npm run prod -- -p [PORT] --audiobooks [AUDIOBOOKS_PATH] --config [CONFIG_PATH] --metadata [METADATA_PATH]
```

## Contributing

Feel free to help out