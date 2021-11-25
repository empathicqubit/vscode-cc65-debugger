#! /bin/bash
{ while ! test -e "$(dirname "${@:2:1}")/libMesenCore.dll" ; do "$@" ; done ; } || echo 'merp' ; xeyes & "$@" && kill -9 $(pidof xeyes) || ls -R "$()"
