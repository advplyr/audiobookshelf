#!/bin/bash
# Refresh a flat apt directory that already contains every audiobookshelf .deb.
# Scan the whole directory. Scanning only the new package would replace Packages
# with a one-entry index and hide every older version.
set -euo pipefail

archive_dir="${1:?Usage: build/update-apt-archive.sh <apt-archive-directory>}"
archive_dir="$(cd "$archive_dir" && pwd)"

if [ -z "${GPG_PRIVATE_KEY:-}" ]; then
  echo "GPG_PRIVATE_KEY is required to sign the apt archive."
  exit 1
fi

shopt -s nullglob
debs=("$archive_dir"/audiobookshelf_*_amd64.deb)
shopt -u nullglob
if [ "${#debs[@]}" -eq 0 ]; then
  echo "No audiobookshelf amd64 packages in $archive_dir"
  exit 1
fi

cd "$archive_dir"
dpkg-scanpackages --multiversion . /dev/null > Packages
gzip -9c Packages > Packages.gz

{
  echo "Origin: Audiobookshelf"
  echo "Label: Audiobookshelf"
  echo "Suite: stable"
  echo "Codename: stable"
  echo "Architectures: amd64"
  echo "Date: $(date -u -R)"
  for field in MD5Sum SHA1 SHA256 SHA512; do
    case "$field" in
      MD5Sum) cmd=md5sum ;;
      SHA1) cmd=sha1sum ;;
      SHA256) cmd=sha256sum ;;
      SHA512) cmd=sha512sum ;;
    esac
    echo "${field}:"
    for file in Packages Packages.gz; do
      sum="$("$cmd" "$file" | awk '{print $1}')"
      size="$(wc -c < "$file" | tr -d ' ')"
      printf ' %s %s %s\n' "$sum" "$size" "$file"
    done
  done
} > Release

gnupg_home="$(mktemp -d)"
chmod 700 "$gnupg_home"
cleanup() {
  rm -rf "$gnupg_home"
}
trap cleanup EXIT

printf '%s' "$GPG_PRIVATE_KEY" | tr -d '\r' > "$gnupg_home/private.asc"
printf '%s\n' "${GPG_PASSPHRASE-}" > "$gnupg_home/passphrase"
chmod 600 "$gnupg_home/private.asc" "$gnupg_home/passphrase"

export GNUPGHOME="$gnupg_home"
# gpg exits 2 when it imports a key and also prints a warning. The fingerprint check below is the success test.
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$gnupg_home/passphrase" --import "$gnupg_home/private.asc" || true
fingerprint="$(gpg --batch --with-colons --list-secret-keys | awk -F: '/^fpr:/ { print $10; exit }')"
if [ -z "$fingerprint" ]; then
  echo "GPG_PRIVATE_KEY did not import a secret key."
  exit 1
fi

rm -f Release.gpg InRelease
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$gnupg_home/passphrase" \
  --local-user "$fingerprint" --armor --detach-sign --output Release.gpg Release
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$gnupg_home/passphrase" \
  --local-user "$fingerprint" --clearsign --output InRelease Release

echo "Signed apt archive in $archive_dir ($(basename "${debs[-1]}") and $((${#debs[@]} - 1)) older package(s))"
