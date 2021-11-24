#! /bin/sh
#"$@"
xeyes & "$@" && kill -9 $(pidof xeyes)
