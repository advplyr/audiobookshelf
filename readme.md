<br />
<div align="center">
   <img alt="Audiobookshelf Banner" src="https://github.com/advplyr/audiobookshelf/raw/master/images/banner.svg" width="600">

  <p align="center">
    <br />
    <a href="https://audiobookshelf.org/docs">Documentation</a>
    ·
    <a href="https://audiobookshelf.org/install">Install Guides</a>
    ·
    <a href="https://audiobookshelf.org/showcase">Showcase</a>
  </p>
</div>

## About

Audiobookshelf is a self-hosted audiobook server for managing and playing your audiobooks.

### Features

* Fully **open-source**, including the [android app](https://github.com/advplyr/audiobookshelf-app) *(in beta)*
* Stream all audiobook formats on the fly
* Multi-user support w/ custom permissions
* Keeps progress per user and syncs across devices
* Auto-detects library updates, no need to re-scan
* Upload full audiobooks and covers
* Backup your metadata + automated daily backups

Is there a feature you are looking for? [Suggest it](https://github.com/advplyr/audiobookshelf/issues/new)

Android app is in beta, try it out on the [Google Play Store](https://play.google.com/store/apps/details?id=com.audiobookshelf.app)

<img alt="Library Screenshot" src="https://github.com/advplyr/audiobookshelf/raw/master/images/LibraryStream.png" />

## Organizing your audiobooks

#### Directory structure and folder names are critical to AudioBookshelf!

 See [documentation](https://audiobookshelf.org/docs) for supported directory structure, folder naming conventions, and audio file metadata usage.




## Installation

** Default username is "root" with no password

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

See [instructions](https://www.audiobookshelf.org/install#debian)


#### Linux file locations

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