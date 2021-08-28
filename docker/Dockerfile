FROM node:13-buster
RUN sed -i 's@debian.org/debian [[:alpha:]]* main@& contrib@g' /etc/apt/sources.list
RUN grep 'debian.org/debian [[:alpha:]]* main' /etc/apt/sources.list \
    | grep -v '#' \
    | sed -e 's/^deb/deb-src/g' >> /etc/apt/sources.list
RUN apt-get update && \
    apt-get build-dep --no-install-recommends -y vice && \
    apt-get install -y --no-install-recommends curl python3-fonttools dos2unix cc65 && \
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
RUN npm install -g pnpm@5.5.10
