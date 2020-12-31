FROM node:13-buster
RUN sed -i 's@debian.org/debian [[:alpha:]]* main@& contrib@g' /etc/apt/sources.list
RUN grep 'debian.org/debian [[:alpha:]]* main' /etc/apt/sources.list \
    | grep -v '#' \
    | sed -e 's/^deb/deb-src/g' >> /etc/apt/sources.list
RUN apt-get update && \
    apt-get build-dep --no-install-recommends -y vice && \
    apt-get install -y --no-install-recommends python3-fonttools dos2unix cc65 && \
    apt-get clean && rm -rf /var/cache/apt/lists/*
RUN npm install -g pnpm@5.5.10
