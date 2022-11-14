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
    apt-get clean && rm -rf /var/lib/apt/lists/*
# APT mirror set
RUN pip3 install --upgrade pip
RUN pip3 install setuptools
RUN pip3 install --user apt-smart

RUN PATH=$PATH:$HOME/.local/bin apt-smart -a

# Install VICE dependencies and misc.
RUN apt-get update && \
    apt-get build-dep --no-install-recommends -y vice && \
    apt-get install -y --no-install-recommends rsync curl dos2unix p7zip-full zip gpg subversion build-essential xa65 automake autoconf openjdk-17-jre && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install AppleWin deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends lsb-release gnupg ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
RUN curl -L https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | tee /usr/share/keyrings/kitware-archive-keyring.gpg >/dev/null
RUN echo "deb [signed-by=/usr/share/keyrings/kitware-archive-keyring.gpg] https://apt.kitware.com/ubuntu/ $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/kitware.list >/dev/null

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        cmake \
        make \
        gcc \
        g++ \
        libyaml-dev \
        libminizip-dev \
        libboost-program-options-dev \
        libncurses-dev \
        libevdev-dev \
        libsdl2-dev \
        libsdl2-image-dev \
        libgl-dev \
        libpcap-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Build VICE
ADD ./build-vice.sh /build-vice.sh
RUN chmod a+rx /build-vice.sh && \
    for each in 3.5 3.6 ; do \
        /build-vice.sh $each builds --enable-headlessui ; \
    done

# Install cross build tools for CC65
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y gcc-multilib-i686-linux-gnu mingw-w64 libc6-dev-arm64-cross libc6-arm64-cross gcc-aarch64-linux-gnu gcc-multilib-arm-linux-gnueabi gcc-multilib-arm-linux-gnueabihf libc6:i386 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Git
ADD git-core.key /git-core.key
RUN apt-get update && \
    apt-get install --no-install-recommends -y gpg-agent && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
RUN echo 'deb http://ppa.launchpad.net/git-core/ppa/ubuntu bionic main' > /etc/apt/sources.list.d/git-core.list && \
    echo 'deb-src http://ppa.launchpad.net/git-core/ppa/ubuntu bionic main' >> /etc/apt/sources.list.d/git-core.list && \
    apt-key add /git-core.key
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install node
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
RUN curl -f https://get.pnpm.io/v6.14.js | node - add --global pnpm

# Install Mesen deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends gnupg ca-certificates  && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 3FA7E0328081BFF6A14DA29AA6A19B38D3D831EF
RUN echo "deb https://download.mono-project.com/repo/ubuntu stable-bionic main" | tee /etc/apt/sources.list.d/mono-official-stable.list
RUN apt-get update && \
    apt-get install -y --no-install-recommends mono-complete libsdl2-2.0 gnome-themes-standard xvfb x11-apps && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

USER root

# Install VSCode 1.62 (which supports the stupid ms-enable CLI switch)
ADD ./vscode.list /etc/apt/sources.list.d/vscode.list
ADD ./vscode.key /vscode.key
RUN apt-key add ./vscode.key && \
    apt-get update && \
    apt-get install -y --no-install-recommends code=1.62.3-1637137107 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Cache pnpm packages
ADD https://raw.githubusercontent.com/empathicqubit/vscode-cc65-debugger/master/package.json /app/package.json
RUN cd /app && pnpm install

# Patch pnpm for Github Actions groups
ADD pnpm.patch /app/pnpm.patch
RUN cd /usr/pnpm-global/5/node_modules/pnpm/dist && patch -Np1 < /app/pnpm.patch
