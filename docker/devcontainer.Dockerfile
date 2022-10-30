FROM empathicqubit/vscode-cc65-debugger-build

ENV desktop_lite_package_list \
    tigervnc-standalone-server \
    tigervnc-common \
    fluxbox \
    dbus-x11 \
    x11-utils \
    x11-xserver-utils \
    xdg-utils \
    fbautostart \
    at-spi2-core \
    xterm \
    eterm \
    nautilus\
    mousepad \
    seahorse \
    gnome-icon-theme \
    gnome-keyring \
    libx11-dev \
    libxkbfile-dev \
    libsecret-1-dev \
    libgbm-dev \
    libnotify4 \
    libnss3 \
    libxss1 \
    libasound2 \
    xfonts-base \
    xfonts-terminus \
    fonts-noto \
    fonts-wqy-microhei \
    fonts-droid-fallback \
    htop \
    ncdu \
    curl \
    ca-certificates\
    unzip \
    nano \
    locales

RUN apt-get update && \
    apt-get install -y --no-install-recommends libglew2.0 libglew-dev ${desktop_lite_package_list} && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN /build-vice.sh 3.6 default

USER 1000

ENV PATH ${PATH}:/vices/default/vice-3.6/src