pushd %~dp0
set SCRIPT_DIR=%CD%
popd

for %%i in (code) do @set CODE=%%~$PATH:i

set BUILD=%SCRIPT_DIR%/dist/build.js
set ELECTRON_RUN_AS_NODE=1
"%CODE%" "%BUILD%" %*
