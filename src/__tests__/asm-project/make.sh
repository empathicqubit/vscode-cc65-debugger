DIR="$( cd "$( dirname "$(readlink -f "$0")" )" > /dev/null && pwd )"
SHPATH="$(echo "$HOME/.vscode/extensions/entan-gl.cc65-vice-"*"/build.sh")"
if ! test -e "$DIR/../../../build.sh"; then
    sh "$DIR/../../../build.sh" make "$@"
elif test -e "$SHPATH"; then
    sh "$SHPATH" make "$@"
else
    make "$@"
fi
