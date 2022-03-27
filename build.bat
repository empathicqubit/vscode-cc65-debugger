setlocal enabledelayedexpansion enableextensions
pushd "%~dp0"
set SCRIPT_DIR=%CD%
popd

for %%i in (code) do @set CODE=%%~$PATH:i

call :dirname CODE_DIR "!CODE!"

set BUILD=%SCRIPT_DIR%/dist/debug-adapter.js
set ELECTRON_RUN_AS_NODE=1

set STUPID_SWITCH=
"%CODE_DIR%\..\code" -e "process.exit(0)" --ms-enable-electron-run-as-node
if %errorlevel%==0 set STUPID_SWITCH=--ms-enable-electron-run-as-node

"%CODE_DIR%\..\code" "%BUILD%" %STUPID_SWITCH% build %*

goto eof

:dirname <resultVar> <pathVar>
(
    set "%~1=%~dp2"
    exit /b
)

:eof
endlocal
