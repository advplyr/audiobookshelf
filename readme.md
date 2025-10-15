<br />
<div align="center">
   <img alt="Audiobookshelf Banner" src="https://github.com/advplyr/audiobookshelf/raw/master/images/banner.svg" width="600">

  <p align="center">
    <br />
    <a href="https://audiobookshelf.org/docs">Documentation</a>
    ·
    <a href="https://audiobookshelf.org/guides">User Guides</a>
    ·
    <a href="https://audiobookshelf.org/support">Support</a>
  </p>
</div>

# About

Audiobookshelf is a self-hosted audiobook and podcast server.

### Features

- Fully **open-source**, including the [android & iOS app](https://github.com/advplyr/audiobookshelf-app) _(in beta)_
- Stream all audio formats on the fly
- Search and add podcasts to download episodes w/ auto-download
- Multi-user support w/ custom permissions
- Keeps progress per user and syncs across devices
- Auto-detects library updates, no need to re-scan
- Upload books and podcasts w/ bulk upload drag and drop folders
- Backup your metadata + automated daily backups
- Progressive Web App (PWA)
- Chromecast support on the web app and android app
- Fetch metadata and cover art from several sources
- Chapter editor and chapter lookup (using [Audnexus API](https://audnex.us/))
- Merge your audio files into a single m4b
- Embed metadata and cover image into your audio files
- Basic ebook support and ereader
  - Epub, pdf, cbr, cbz
  - Send ebook to device (i.e. Kindle)
- Open RSS feeds for podcasts and audiobooks

Is there a feature you are looking for? [Suggest it](https://github.com/advplyr/audiobookshelf/issues/new/choose)

Join us on [Discord](https://discord.gg/HQgCbd6E75)

### Demo

Check out the web client demo: https://audiobooks.dev/ (thanks for hosting [@Vito0912](https://github.com/Vito0912)!)

Username/password: `demo`/`demo` (user account)

### Android App (beta)

Try it out on the [Google Play Store](https://play.google.com/store/apps/details?id=com.audiobookshelf.app)

### iOS App (beta)

**Beta is currently full. Apple has a hard limit of 10k beta testers. Updates will be posted in Discord.**

Using Test Flight: https://testflight.apple.com/join/wiic7QIW **_(beta is full)_**

### Build your own tools & clients

Check out the [API documentation](https://api.audiobookshelf.org/)

<br />

<img alt="Library Screenshot" src="https://github.com/advplyr/audiobookshelf/raw/master/images/DemoLibrary.png" />

<br />

# Organizing your audiobooks

#### Directory structure and folder names are important to Audiobookshelf!

See [documentation](https://audiobookshelf.org/docs#book-directory-structure) for supported directory structure, folder naming conventions, and audio file metadata usage.

<br />

# Installation

See [install docs](https://www.audiobookshelf.org/docs)

<br />

# Reverse Proxy Set Up

#### Important! Audiobookshelf requires a websocket connection.

#### Note: Using a subfolder is supported with no additional changes but the path must be `/audiobookshelf` (this is not changeable). See [discussion](https://github.com/advplyr/audiobookshelf/discussions/3535)

### NGINX Proxy Manager

Toggle websockets support.

<img alt="NGINX Web socket" src="https://user-images.githubusercontent.com/67830747/153679106-b2a7f5b9-0702-48c6-9740-b26b401986e9.png" />

### NGINX Reverse Proxy

Add this to the site config file on your nginx server after you have changed the relevant parts in the <> brackets, and inserted your certificate paths.

```bash
server {
   listen 443 ssl;
   server_name <sub>.<domain>.<tld>;

   access_log /var/log/nginx/audiobookshelf.access.log;
   error_log /var/log/nginx/audiobookshelf.error.log;

   ssl_certificate      /path/to/certificate;
   ssl_certificate_key  /path/to/key;

   location / {
      proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto  $scheme;
      proxy_set_header Host               $http_host;
      proxy_set_header Upgrade            $http_upgrade;
      proxy_set_header Connection         "upgrade";

      proxy_http_version                  1.1;

      proxy_pass                          http://<URL_to_forward_to>;
      proxy_redirect                      http:// https://;

      # Prevent 413 Request Entity Too Large error
      # by increasing the maximum allowed size of the client request body
      # For example, set it to 10 GiB
      client_max_body_size                10240M;
   }
}
```

### Apache Reverse Proxy

Add this to the site config file on your Apache server after you have changed the relevant parts in the <> brackets, and inserted your certificate paths.

For this to work you must enable at least the following mods using `a2enmod`:

- `ssl`
- `proxy`
- `proxy_http`
- `proxy_balancer`
- `proxy_wstunnel`
- `rewrite`

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

If using Apache >= 2.4.47 you can use the following, without having to use any of the `RewriteEngine`, `RewriteCond`, or `RewriteRule` directives. For example:

```xml
    <Location /audiobookshelf>
        ProxyPreserveHost on
        ProxyPass http://localhost:<audiobookshelf_port>/audiobookshelf upgrade=websocket
        ProxyPassReverse http://localhost:<audiobookshelf_port>/audiobookshelf
    </Location>
```

Some SSL certificates like those signed by Let's Encrypt require ACME validation. To allow Let's Encrypt to write and confirm the ACME challenge, edit your VirtualHost definition to prevent proxying traffic that queries `/.well-known` and instead serve that directly:

```bash
<VirtualHost *:443>
    # ...

    # create the directory structure  /.well-known/acme-challenges
    # within DocumentRoot and give the HTTP user recursive write
    # access to it.
    DocumentRoot /path/to/local/directory

    ProxyPreserveHost On
    ProxyPass /.well-known !
    ProxyPass / http://localhost:<audiobookshelf_port>/

    # ...
</VirtualHost>
```

### SWAG Reverse Proxy

[See LinuxServer.io config sample](https://github.com/linuxserver/reverse-proxy-confs/blob/master/audiobookshelf.subdomain.conf.sample)

### Synology NAS Reverse Proxy Setup (DSM 7+/Quickconnect)

1. **Open Control Panel**

   - Navigate to `Login Portal > Advanced`.

2. **General Tab**

   - Click `Reverse Proxy` > `Create`.

   | Setting            | Value          |
   | ------------------ | -------------- |
   | Reverse Proxy Name | audiobookshelf |

3. **Source Configuration**

   | Setting                | Value                                    |
   | ---------------------- | ---------------------------------------- |
   | Protocol               | HTTPS                                    |
   | Hostname               | `<sub>.<quickconnectdomain>.synology.me` |
   | Port                   | 443                                      |
   | Access Control Profile | Leave as is                              |

   - Example Hostname: `audiobookshelf.mydomain.synology.me`

4. **Destination Configuration**

   | Setting  | Value       |
   | -------- | ----------- |
   | Protocol | HTTP        |
   | Hostname | Your NAS IP |
   | Port     | 13378       |

5. **Custom Header Tab**

   - Go to `Create > Websocket`.
   - Configure Headers (leave as is):

   | Header Name | Value                 |
   | ----------- | --------------------- |
   | Upgrade     | `$http_upgrade`       |
   | Connection  | `$connection_upgrade` |

6. **Advanced Settings Tab**
   - Leave as is.

### [Traefik Reverse Proxy](https://doc.traefik.io/traefik/)

Middleware relating to CORS will cause the app to report Unknown Error when logging in. To prevent this don't apply any of the following headers to the router for this site:

<ul>
   <li>accessControlAllowMethods</li>
   <li>accessControlAllowOriginList</li>
   <li>accessControlMaxAge</li>
</ul>

From [@Dondochaka](https://discord.com/channels/942908292873723984/942914154254176257/945074590374318170) and [@BeastleeUK](https://discord.com/channels/942908292873723984/942914154254176257/970366039294611506) <br />

### Example Caddyfile - [Caddy Reverse Proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)

```
subdomain.domain.com {
        encode gzip zstd
        reverse_proxy <LOCAL_IP>:<PORT>
}
```

### HAProxy

Below is a generic HAProxy config, using `audiobookshelf.YOUR_DOMAIN.COM`.

To use `http2`, `ssl` is needed.

```make
global
    # ... (your global settings go here)

defaults
    mode http
    # ... (your default settings go here)

frontend my_frontend
    # Bind to port 443, enable SSL, and specify the certificate list file
    bind :443 name :443 ssl crt-list /path/to/cert.crt_list alpn h2,http/1.1
    mode http

    # Define an ACL for subdomains starting with "audiobookshelf"
    acl is_audiobookshelf hdr_beg(host) -i audiobookshelf

    # Use the ACL to route traffic to audiobookshelf_backend if the condition is met,
    # otherwise, use the default_backend
    use_backend audiobookshelf_backend if is_audiobookshelf
    default_backend default_backend

backend audiobookshelf_backend
    mode http
    # ... (backend settings for audiobookshelf go here)

    # Define the server for the audiobookshelf backend
    server audiobookshelf_server 127.0.0.99:13378

backend default_backend
    mode http
    # ... (default backend settings go here)

    # Define the server for the default backend
    server default_server 127.0.0.123:8081

```

### pfSense and HAProxy

For pfSense the inputs are graphical, and `Health checking` is enabled.

#### Frontend, Default backend, access control lists and actions

##### Access Control lists

|      Name      |    Expression     | CS  | Not |      Value      |
| :------------: | :---------------: | :-: | :-: | :-------------: |
| audiobookshelf | Host starts with: |     |     | audiobookshelf. |

##### Actions

The `condition acl names` needs to match the name above `audiobookshelf`.

|    Action     |   Parameters   | Condition acl names |
| :-----------: | :------------: | :-----------------: |
| `Use Backend` | audiobookshelf |   audiobookshelf    |

#### Backend

The `Name` needs to match the `Parameters` above `audiobookshelf`.

| Name | audiobookshelf |
| ---- | -------------- |

##### Server list:

|      Name      |    Expression     | CS  | Not |      Value      |
| :------------: | :---------------: | :-: | :-: | :-------------: |
| audiobookshelf | Host starts with: |     |     | audiobookshelf. |

##### Health checking:

Health checking is enabled by default. `Http check method` of `OPTIONS` is not supported on Audiobookshelf. If Health check fails, data will not be forwared. Need to do one of following:

- To disable: Change `Health check method` to `none`.
- To make Health checking function: Change `Http check method` to `HEAD` or `GET`.

# Run from source

# Contributing

This application is built using [NodeJs](https://nodejs.org/).

### Localization

Thank you to [Weblate](https://hosted.weblate.org/engage/audiobookshelf/) for hosting our localization infrastructure pro-bono. If you want to see Audiobookshelf in your language, please help us localize. Additional information on helping with the translations [here](https://www.audiobookshelf.org/faq#how-do-i-help-with-translations). <a href="https://hosted.weblate.org/engage/audiobookshelf/"> <img src="https://hosted.weblate.org/widget/audiobookshelf/abs-web-client/multi-auto.svg" alt="Translation status" /> </a>

### Dev Container Setup

The easiest way to begin developing this project is to use a dev container. An introduction to dev containers in VSCode can be found [here](https://code.visualstudio.com/docs/devcontainers/containers).

Required Software:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VSCode](https://code.visualstudio.com/download)

_Note, it is possible to use other container software than Docker and IDEs other than VSCode. However, this setup is more complicated and not covered here._

<div>
<details>
<summary>Install the required software on Windows with <a href=(https://docs.microsoft.com/en-us/windows/package-manager/winget/#production-recommended)>winget</a></summary>

<p>
Note: This requires a PowerShell prompt with winget installed.  You should be able to copy and paste the code block to install.  If you use an elevated PowerShell prompt, UAC will not pop up during the installs.

```PowerShell
winget install -e --id Docker.DockerDesktop; `
winget install -e --id Microsoft.VisualStudioCode
```

</p>
</details>
</div>

<div>
<details>
<summary>Install the required software on MacOS with <a href=(https://snapcraft.io/)>homebrew</a></summary>

<p>

```sh
brew install --cask docker visual-studio-code
```

</p>
</details>
</div>

<div style="padding-bottom: 1em">
<details>
<summary>Install the required software on Linux with <a href=(https://brew.sh/)>snap</a></summary>

<p>

```sh
sudo snap install docker; \
sudo snap install code --classic
```

</p>
</details>
</div>

After installing these packages, you can now install the [Remote Development](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack) extension for VSCode. After installing this extension open the command pallet (`ctrl+shift+p` or `cmd+shift+p`) and select the command `>Dev Containers: Rebuild and Reopen in Container`. This will cause the development environment container to be built and launched.

You are now ready to start development!

### Manual Environment Setup

If you don't want to use the dev container, you can still develop this project. First, you will need to install [NodeJs](https://nodejs.org/) (version 20) and [FFmpeg](https://ffmpeg.org/).

Next you will need to create a `dev.js` file in the project's root directory. This contains configuration information and paths unique to your development environment. You can find an example of this file in `.devcontainer/dev.js`.

You are now ready to build the client:

```sh
npm ci
cd client
npm ci
npm run generate
cd ..
```

### Development Commands

After setting up your development environment, either using the dev container or using your own custom environment, the following commands will help you run the server and client.

To run the server, you can use the command `npm run dev`. This will use the client that was built when you ran `npm run generate` in the client directory or when you started the dev container. If you make changes to the server, you will need to restart the server. If you make changes to the client, you will need to run the command `(cd client; npm run generate)` and then restart the server. By default the client runs at `localhost:3333`, though the port can be configured in `dev.js`.

You can also build a version of the client that supports live reloading. To do this, start the server, then run the command `(cd client; npm run dev)`. This will run a separate instance of the client at `localhost:3000` that will be automatically updated as you make changes to the client.

If you are using VSCode, this project includes a couple of pre-defined targets to speed up this process. First, if you build the project (`ctrl+shift+b` or `cmd+shift+b`) it will automatically generate the client. Next, there are debug commands for running the server and client. You can view these targets using the debug panel (bring it up with (`ctrl+shift+d` or `cmd+shift+d`):

- `Debug server`—Run the server.
- `Debug client (nuxt)`—Run the client with live reload.
- `Debug server and client (nuxt)`—Runs both the preceding two debug targets.

# How to Support

[See the incomplete "How to Support" page](https://www.audiobookshelf.org/support)
