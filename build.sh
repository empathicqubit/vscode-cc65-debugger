#! /bin/sh
READLINK="$(which greadlink readlink | head -1)"
DIR="$( cd "$( dirname "$("$READLINK" -f "$0")" )" > /dev/null && pwd )"
echo "$DIR"
BUILD="$DIR/dist/debug-adapter.js"
CODE="/snap/code/current/usr/share/code/code"

if test "$(uname)" = "Darwin" ; then
    APPPATH="/Applications/Visual Studio Code.app"
    if ! test -e "$APPPATH" ; then
        APPPATH="$(ps ax -o command | grep -v '^grep' | grep 'Visual Studio Code.app' | awk -F'/Contents/' '{print $1}' | uniq)"
    fi
    CODE="$APPPATH/Contents/MacOS/Electron"
elif ! test -e "$CODE" ; then
    CODE="$(dirname "$(dirname "$(which code)")")/share/code/code"
fi

if ! test -e "$CODE" ; then
    echo "You must install VSCode to use this script."
    exit 1
fi

# MS introduced this freaking command line switch 1.62 Oct 2021
STUPID_SWITCH=""
if ELECTRON_RUN_AS_NODE=1 "$CODE" -e "process.exit(0)" --ms-enable-electron-run-as-node ; then
    STUPID_SWITCH="--ms-enable-electron-run-as-node"
fi

ELECTRON_RUN_AS_NODE=1 "$CODE" "$BUILD" $STUPID_SWITCH build "$@"
