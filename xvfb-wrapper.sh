#! /bin/bash
xeyes & "$@" && kill -9 $(pidof xeyes)
