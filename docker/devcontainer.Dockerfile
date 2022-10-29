FROM empathicqubit/vscode-cc65-debugger-build

RUN apt-get update && \
    apt-get install libglew2.0 libglew-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN /build-vice.sh 3.6 default

ENV PATH ${PATH}:/vices/default/vice-3.6/src