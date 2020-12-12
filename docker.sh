set -x -e
sed -i 's@debian.org/debian [[:alpha:]]* main@& contrib@g' /etc/apt/sources.list
grep 'debian.org/debian [[:alpha:]]* main' /etc/apt/sources.list | grep -v '#' | sed -e 's/^deb/deb-src/g' >> /etc/apt/sources.list
apt-get update
apt-get build-dep --no-install-recommends -y vice
apt-get install -y --no-install-recommends dos2unix cc65
npm install -g pnpm@5.5.10
pnpm install --shamefully-hoist
pnpm package
