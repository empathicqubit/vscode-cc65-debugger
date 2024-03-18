#! /bin/sh
READLINK="$(which greadlink readlink | head -1)"
DIR="$( cd "$( dirname "$( "$READLINK" -f "$0" )" )" > /dev/null && pwd )"
if test -e "$DIR/../../../build.sh"; then
    sh "$DIR/../../../build.sh" make "$@"
else
    make "$@"
fi
