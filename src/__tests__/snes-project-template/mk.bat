pushd %~dp0
set SCRIPT_DIR=%CD%
popd

for /D %%I in ("%USERPROFILE%\.vscode\extensions\entan-gl.cc65-vice-*") do @set EXTENSION_PATH=%%~I\build.bat

if exist "%SCRIPT_DIR%\..\..\..\build.bat" (
    "%SCRIPT_DIR%\..\..\..\build.bat" make.exe %*
) else if exist "%EXTENSION_PATH%" (
    "%EXTENSION_PATH%" make.exe %*
) else (
    make.exe %*
)
