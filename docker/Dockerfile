FROM ubuntu:bionic
ENV DEBIAN_FRONTEND noninteractive
RUN grep 'ubuntu.com/ubuntu' /etc/apt/sources.list \
    | grep '# deb-src' \
    | sed -e 's/^# //g' >> /etc/apt/sources.list
RUN sed -i 's@http://archive.ubuntu.com/ubuntu@mirror://mirrors.ubuntu.com/mirrors.txt@g' /etc/apt/sources.list
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    apt-get build-dep --no-install-recommends -y vice && \
    apt-get install -y --no-install-recommends curl dos2unix cc65 zip gcc-multilib-i686-linux-gnu mingw-w64 libc6-dev-arm64-cross libc6-arm64-cross gcc-aarch64-linux-gnu gcc-multilib-arm-linux-gnueabi gcc-multilib-arm-linux-gnueabihf && \
    apt-get clean && rm -rf /var/cache/apt/lists/*
RUN echo 'deb http://ppa.launchpad.net/git-core/ppa/ubuntu bionic main' > /etc/apt/sources.list.d/git-core.list && \
    echo 'deb-src http://ppa.launchpad.net/git-core/ppa/ubuntu bionic main' >> /etc/apt/sources.list.d/git-core.list
RUN apt-get update && \
    apt-get install -y --no-install-recommends git unzip subversion xa65 && \
    apt-get clean && rm -rf /var/cache/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs python3-pip build-essential automake autoconf && \
    apt-get clean && rm -rf /var/cache/apt/lists/*
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
RUN curl -f https://get.pnpm.io/v6.14.js | node - add --global pnpm
RUN useradd -m -u 1000 unprivileged
USER unprivileged
RUN pip3 install --user fonttools
USER root
RUN pip3 install --user fonttools