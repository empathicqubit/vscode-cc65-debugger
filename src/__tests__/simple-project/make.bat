pushd %~dp0
set SCRIPT_DIR=%CD%
popd

if exist "%SCRIPT_DIR%\..\..\..\build.bat" (
    "%SCRIPT_DIR%\..\..\..\build.bat" make.exe %*
) else if exist "%USERPROFILE%\.vscode\extensions\entan-gl.cc65-vice-*\build.bat" (
    "%USERPROFILE%\.vscode\extensions\entan-gl.cc65-vice-*\build.bat" make.exe %*
) else (
    make.exe %*
)
