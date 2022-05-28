setlocal enabledelayedexpansion enableextensions
pushd "%~dp0"
set SCRIPT_DIR=%CD%
popd

for %%i in (code) do @set CODE=%%~$PATH:i

call :dirname CODE_DIR "!CODE!"

set BUILD=%SCRIPT_DIR%/dist/debug-adapter.js
set ELECTRON_RUN_AS_NODE=1

"%CODE_DIR%\..\code" "%BUILD%" --ms-enable-electron-run-as-node build %*

goto eof

:dirname <resultVar> <pathVar>
(
    set "%~1=%~dp2"
    exit /b
)

:eof
endlocal
