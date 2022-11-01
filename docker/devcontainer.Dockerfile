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

ENV audio_lite_package_list \
    make \
    cmake \
    libasound2-dev \
    ca-certificates \
    libnotify-dev \
    libnotify4 \
    libssl-dev \
    openssl \
    pulseaudio \
    cargo \
    mumble-server

RUN apt-get update && \
    apt-get install -y --no-install-recommends sudo less psmisc libglew2.0 libglew-dev ${desktop_lite_package_list} ${audio_lite_package_list} && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN /build-vice.sh 3.6 default
RUN ln -s /vices/default/vice-3.6/data /usr/local/share/vice

RUN useradd -m -u 1000 vscode
RUN chsh -s /bin/bash vscode
RUN usermod -a -G sudo vscode
ADD ./sudoers /etc/sudoers.d/nopasswd
USER 1000

ENV PATH ${PATH}:/vices/default/vice-3.6/src