DIR="$( cd "$( dirname "$(readlink -f "$0")" )" > /dev/null && pwd )"
echo "$DIR"
BUILD="$DIR/dist/debug-adapter.js"
CODE="/snap/code/current/usr/share/code/code"

if ! test -e "$CODE" ; then
    CODE="$(dirname "$(dirname "$(which code)")")/share/code/code"
fi

ELECTRON_RUN_AS_NODE=1 "$CODE" "$BUILD" build "$@"