#! /bin/bash
xeyes & { "$@" || "$@" ; } && kill -9 $(pidof xeyes) || ls -R "$(dirname "${@:2:1}")"
