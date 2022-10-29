#! /bin/bash
set -e

version=$1
shift
folr=$2
shift

mkdir -p /vices/sources
cd /vices/sources
curl -L https://downloads.sourceforge.net/project/vice-emu/releases/vice-$each.tar.gz > /vices/sources/vice-$version.tar.gz
tar xvf /vices/sources/vice-$version.tar.gz
mkdir -p /vices/$folr/vice-$version
cd /vices/$folr/vice-$version
/vices/sources/vice-${version}*/configure --disable-pdf-docs "$@"
rsync -rav --ignore-existing /vices/sources/vice-${version}*/data/. ./data/.
make -j$(nproc)

rm -rf /vices/sources