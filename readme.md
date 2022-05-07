<br />
<div align="center">
   <img alt="Audiobookshelf Banner" src="https://github.com/advplyr/audiobookshelf/raw/master/images/banner.svg" width="600">

  <p align="center">
    <br />
    <a href="https://audiobookshelf.org/docs">Documentation</a>
    ·
    <a href="https://audiobookshelf.org/install">Install Guides</a>
    ·
    <a href="https://audiobookshelf.org/support">Support</a>
  </p>
</div>

# About

Audiobookshelf is a self-hosted audiobook and podcast server.

### Features

* Fully **open-source**, including the [android & iOS app](https://github.com/advplyr/audiobookshelf-app) *(in beta)*
* Stream all audio formats on the fly
* Search and add podcasts to download episodes w/ auto-download
* Multi-user support w/ custom permissions
* Keeps progress per user and syncs across devices
* Auto-detects library updates, no need to re-scan
* Upload books and podcasts w/ bulk upload drag and drop folders
* Backup your metadata + automated daily backups
* Progressive Web App (PWA)
* Chromecast support on the web app and android app
* Fetch metadata and cover art from several sources
* Basic ebook support and e-reader *(experimental)*
* Merge your audio files into a single m4b w/ metadata and embedded cover *(experimental)*

Is there a feature you are looking for? [Suggest it](https://github.com/advplyr/audiobookshelf/issues/new/choose)

Join us on [discord](https://discord.gg/pJsjuNCKRq)

### Android App (beta)
Try it out on the [Google Play Store](https://play.google.com/store/apps/details?id=com.audiobookshelf.app)

### iOS App (early beta)
Available using Test Flight: https://testflight.apple.com/join/wiic7QIW - [Join the discussion](https://github.com/advplyr/audiobookshelf-app/discussions/60)

<br />

<img alt="Library Screenshot" src="https://github.com/advplyr/audiobookshelf/raw/master/images/LibraryStreamSquare.png" />

<br />

# Organizing your audiobooks

#### Directory structure and folder names are important to Audiobookshelf!

 See [documentation](https://audiobookshelf.org/docs) for supported directory structure, folder naming conventions, and audio file metadata usage.

<br />

# Installation

** Default username is "root" with no password

### Docker Install
Available in Unraid Community Apps

```bash
docker pull ghcr.io/advplyr/audiobookshelf

docker run -d \
  -e AUDIOBOOKSHELF_UID=99 \
  -e AUDIOBOOKSHELF_GID=100 \
  -p 13378:80 \
  -v </path/to/audiobooks>:/audiobooks \
  -v </path/to/your/podcasts>:/podcasts \
  -v </path/to/config>:/config \
  -v </path/to/metadata>:/metadata \
  --name audiobookshelf \
  ghcr.io/advplyr/audiobookshelf
```

### Docker Update

```bash
docker stop audiobookshelf
docker pull ghcr.io/advplyr/audiobookshelf
docker start audiobookshelf
```

### Running with Docker Compose

```yaml
### docker-compose.yml ###
services:
  audiobookshelf:
    image: ghcr.io/advplyr/audiobookshelf
    environment:
      - AUDIOBOOKSHELF_UID=99
      - AUDIOBOOKSHELF_GID=100
    ports:
      - 13378:80
    volumes:
      - </path/to/your/audiobooks>:/audiobooks
      - </path/to/your/podcasts>:/podcasts
      - </path/to/config>:/config
      - </path/to/metadata>:/metadata
```

### Docker Compose Update

Depending on the version of Docker Compose please run one of the two commands. If not sure on which version you are running you can run the following command and check.

#### Version Check

docker-compose --version or docker compose version

#### v2 Update

```bash
docker compose --file <path/to/config>/docker-compose.yml pull
docker compose --file <path/to/config>/docker-compose.yml up -d
```

#### V1 Update
```bash
docker-compose --file <path/to/config>/docker-compose.yml pull
docker-compose --file <path/to/config>/docker-compose.yml up -d
```

** We recommend updating the the latest version of Docker Compose

### Linux (amd64) Install

Debian package will use this config file `/etc/default/audiobookshelf` if exists. The install will create a user and group named `audiobookshelf`.

### Ubuntu Install via PPA

A PPA is hosted on [github](https://github.com/advplyr/audiobookshelf-ppa)

See [install docs](https://www.audiobookshelf.org/install/#ubuntu)

### Install via debian package

Get the `deb` file from the [github repo](https://github.com/advplyr/audiobookshelf-ppa).

See [install docs](https://www.audiobookshelf.org/install#debian)


#### Linux file locations

Project directory: `/usr/share/audiobookshelf/`

Config file: `/etc/default/audiobookshelf`

System Service: `/lib/systemd/system/audiobookshelf.service`

Ffmpeg static build: `/usr/lib/audiobookshelf-ffmpeg/`

<br />

# Reverse Proxy Set Up

#### Important! Audiobookshelf requires a websocket connection.

### NGINX Proxy Manager

Toggle websockets support.

<img alt="NGINX Web socket" src="https://user-images.githubusercontent.com/67830747/153679106-b2a7f5b9-0702-48c6-9740-b26b401986e9.png" />

### NGINX Reverse Proxy

Add this to the site config file on your nginx server after you have changed the relevant parts in the <> brackets, and inserted your certificate paths.


```bash
server
{
        listen 443 ssl;
        server_name <sub>.<domain>.<tld>;

        access_log /var/log/nginx/audiobookshelf.access.log;
        error_log /var/log/nginx/audiobookshelf.error.log;

        ssl_certificate      /path/to/certificate;
        ssl_certificate_key  /path/to/key;

        location / {
                     proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
                     proxy_set_header  X-Forwarded-Proto $scheme;
                     proxy_set_header  Host              $host;
                     proxy_set_header Upgrade            $http_upgrade;
                     proxy_set_header Connection         "upgrade";

                     proxy_http_version                  1.1;

                     proxy_pass                          http://<URL_to_forward_to>;
                     proxy_redirect                      http:// https://;
                   }
}
``` 

### Apache Reverse Proxy

Add this to the site config file on your Apache server after you have changed the relevant parts in the <> brackets, and inserted your certificate paths.

For this to work you must enable at least the following mods using `a2enmod`:
  - `ssl`
  - `proxy_module`
  - `proxy_wstunnel_module`
  - `rewrite_module`

```bash
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName <sub>.<domain>.<tld>

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined

    ProxyPreserveHost On
    ProxyPass / http://localhost:<audiobookshelf_port>/
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:<audiobookshelf_port>/$1" [P,L]

    # unless you're doing something special this should be generated by a
    # tool like certbot by let's encrypt
    SSLCertificateFile /path/to/cert/file
    SSLCertificateKeyFile /path/to/key/file
</VirtualHost>
</IfModule>
```


### SWAG Reverse Proxy

[See this solution](https://forums.unraid.net/topic/112698-support-audiobookshelf/?do=findComment&comment=1049637)

### Synology Reverse Proxy

1. Open Control Panel > Application Portal
2. Change to the Reverse Proxy tab
3. Select the proxy rule for which you want to enable Websockets and click on Edit
4. Change to the "Custom Header" tab
5. Click Create > WebSocket
6. Click Save

[from @silentArtifact](https://github.com/advplyr/audiobookshelf/issues/241#issuecomment-1036732329)

### [Traefik Reverse Proxy](https://doc.traefik.io/traefik/)

Middleware relating to CORS will cause the app to report Unknown Error when logging in. To prevent this don't apply any of the following headers to the router for this site:

<ul>
   <li>accessControlAllowMethods</li>
   <li>accessControlAllowOriginList</li>
   <li>accessControlMaxAge</li>
</ul>

From [@Dondochaka](https://discord.com/channels/942908292873723984/942914154254176257/945074590374318170) and [@BeastleeUK](https://discord.com/channels/942908292873723984/942914154254176257/970366039294611506)
<br />

# Run from source

[See discussion](https://github.com/advplyr/audiobookshelf/discussions/259#discussioncomment-1869729)

# Contributing / How to Support

[See the incomplete "How to Support" page](https://www.audiobookshelf.org/support)
