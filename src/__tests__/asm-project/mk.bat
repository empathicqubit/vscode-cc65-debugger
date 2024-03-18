pushd %~dp0
set SCRIPT_DIR=%CD%
popd

if exist "%SCRIPT_DIR%\..\..\..\build.bat" (
    "%SCRIPT_DIR%\..\..\..\build.bat" make.exe %*
) else (
    make.exe %*
)
