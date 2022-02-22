#! /bin/sh
READLINK="$(which greadlink readlink | head -1)"
DIR="$( cd "$( dirname "$( "$READLINK" -f "$0" )" )" > /dev/null && pwd )"
if test -e "$DIR/../../../build.sh"; then
    sh "$DIR/../../../build.sh" make "$@"
else
    SHPATH="$(ls -t "$HOME/.vscode/extensions/entan-gl.cc65-vice-"*"/build.sh" | head -1)"
    if test -e "$SHPATH"; then
        sh "$SHPATH" make "$@"
    else
        make "$@"
    fi
fi
