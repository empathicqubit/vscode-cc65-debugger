#! /bin/bash
xeyes & { while ! test -e "$(dirname "${@:2:1}")/libMesenCore.dll" ; do "$@" ; done ; } && "$@" && kill -9 $(pidof xeyes) || ls -R "$()"
