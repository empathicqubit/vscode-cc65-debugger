# I tried to order these deps by least to most likely to change to preserve the cache.
FROM ubuntu:bionic
ENV DEBIAN_FRONTEND noninteractive
# Base APT configuration
RUN grep 'ubuntu.com/ubuntu' /etc/apt/sources.list \
    | grep '# deb-src' \
    | sed -e 's/^# //g' >> /etc/apt/sources.list
RUN sed -i 's@http://archive.ubuntu.com/ubuntu@http://mirror.asergo.com/ubuntu/@g' /etc/apt/sources.list
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates python3-pip && \
    apt-get clean && rm -rf /var/cache/apt/lists/*
# APT mirror set
RUN pip3 install --upgrade pip
RUN pip3 install setuptools
RUN pip3 install --user apt-smart

RUN PATH=$PATH:$HOME/.local/bin apt-smart -a

# Install VICE dependencies and misc.
RUN apt-get update && \
    apt-get build-dep --no-install-recommends -y vice && \
    apt-get install -y --no-install-recommends curl dos2unix zip gpg unzip subversion build-essential xa65 automake autoconf && \
    apt-get clean && rm -rf /var/cache/apt/lists/*

# Build VICE
RUN mkdir /vices && \
    cd /vices && \
    for each in 3.5 ; do \
        curl -sL https://downloads.sourceforge.net/project/vice-emu/releases/vice-$each.tar.gz > /vices/vice-$each.tar.gz && \
        tar xvf /vices/vice-$each.tar.gz && \
        mkdir /vices/vice-$each-build && \
        cd /vices/vice-$each-build && \
        /vices/vice-$each/configure --enable-headlessui --disable-pdf-docs && \
        make -j$(nproc) && \
        rm -rf /vices/vice-$each /vices/vice-$each.tar.gz ; \
    done

# Install cross build tools for CC65
RUN apt-get update && \
    apt-get install -y gcc-multilib-i686-linux-gnu mingw-w64 libc6-dev-arm64-cross libc6-arm64-cross gcc-aarch64-linux-gnu gcc-multilib-arm-linux-gnueabi gcc-multilib-arm-linux-gnueabihf && \
    apt-get clean && rm -rf /var/cache/apt/lists/*

# Install Git
ADD git-core.key /git-core.key
RUN apt-get update && \
    apt-get install --no-install-recommends -y gpg-agent && \
    apt-get clean && rm -rf /var/cache/apt/lists/*
RUN echo 'deb http://ppa.launchpad.net/git-core/ppa/ubuntu bionic main' > /etc/apt/sources.list.d/git-core.list && \
    echo 'deb-src http://ppa.launchpad.net/git-core/ppa/ubuntu bionic main' >> /etc/apt/sources.list.d/git-core.list && \
    apt-key add /git-core.key
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    apt-get clean && rm -rf /var/cache/apt/lists/*

# Install node
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/cache/apt/lists/*
RUN curl -f https://get.pnpm.io/v6.14.js | node - add --global pnpm

RUN useradd -m -u 1000 unprivileged
USER root