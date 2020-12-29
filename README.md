# vscode-cc65-vice-debug

[![Version](https://vsmarketplacebadge.apphb.com/version/entan-gl.cc65-vice.svg)](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/entan-gl.cc65-vice.svg)](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating/entan-gl.cc65-vice.svg)](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)

[![Version](https://img.shields.io/open-vsx/v/entan-gl/cc65-vice)](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)
[![Installs](https://img.shields.io/open-vsx/dt/entan-gl/cc65-vice)](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)
[![Ratings](https://img.shields.io/open-vsx/rating/entan-gl/cc65-vice)](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)

Dependencies and date last changed:


[![VICE](https://img.shields.io/badge/VICE-3.5%202020%2f12%2f24-blue)](https://chocolatey.org/packages/winvice-nightly/3.5.0) 
[![CC65](https://img.shields.io/badge/CC65-2.17%202020%2f09%2f27-blue)](https://chocolatey.org/packages/cc65-compiler/2.17)

This is an extension to let you debug CC65 code made for the Commodore platforms, including the Commodore 64, using [VICE emulator](https://vice-emu.sourceforge.io/) and [Visual Studio Code](https://code.visualstudio.com/).

[Install it here](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)

If you're having trouble understanding how this extension is supposed to be used, or any other issues setting it up, please let me know by [creating an issue](https://github.com/empathicqubit/vscode-cc65-vice-debug/issues) or [messaging me on Twitter](https://twitter.com/intent/tweet?screen_name=empathicqubit).

<img src="https://github.com/empathicqubit/vscode-cc65-vice-debug/blob/master/images/action.png?raw=true" />

- [vscode-cc65-vice-debug](#vscode-cc65-vice-debug)
  * [Setup](#setup)
    + [Windows-specific instructions](#windows-specific-instructions)
    + [Linux-specific instructions (Debian \[and probably also Ubuntu\])](#linux-specific-instructions--debian---and-probably-also-ubuntu---)
  * [Project Configuration](#project-configuration)
  * [Changes needed to your Makefile](#changes-needed-to-your-makefile)
  * [Changes needed to your code](#changes-needed-to-your-code)
  * [What works](#what-works)
  * [What's weird](#what-s-weird)
  * [Building](#building)
  * [Additional Credits (see also LICENSE.md)](#additional-credits--see-also-licensemd-)

<a target="_blank" href="https://donorbox.org/cc65-vice-debugger?default_interval=o"><img src="https://d1iczxrky3cnb2.cloudfront.net/button-small-green.png" /></a>

## Setup

To make sure all the features work, you'll want to install Clang, cc65 2.17
(newer versions should work, however I was having trouble getting a correct build
of my test project), and VICE 3.5 or later.

### Windows-specific instructions

You will need to install LLVM, cc65 2.17 (later versions had problems building
my test project the same way as before), and VICE 3.5 or later. The easiest way
to install these packages to your PATH is to use [Chocolatey](https://chocolatey.org/).

```powershell
# Make sure you use an Administrator shell!

# Skip this command if you have Chocolatey already.
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install the packages
choco install --version 2.17 cc65-compiler
choco install --version 3.5.0 winvice-nightly
choco install llvm
```

### Linux-specific instructions (Debian \[and probably also Ubuntu\])

You will need to install LLVM, cc65 2.17 (later versions had problems building
my test project the same way as before), and VICE 3.5 or later.

For Debian Buster, the latest version of cc65 is 2.17 in the repositories, so
just install it with apt:

```sh
sudo apt install clang-tools-8 cc65
```

To install VICE 3.5 before it is packaged for your distribution, you will need
to build VICE from source, to do that, download the source from the VICE
website, then follow the below steps:

```sh
sudo apt install build-essential checkinstall subversion
sudo apt build-dep vice
cd vice-3.5
./autogen.sh
./configure
make -j$(nproc)
sudo mkdir -p /usr/local/share/{vice/C64,doc/vice} && sudo checkinstall -y --exclude=/home --install=yes --pkgname=vice --pkgversion=3.5.0 --summary='VICE is a Commodore 64 emulator. This is a version I built to be able to use new features required by VSCode.' --provides=vice --requires='libasound2, libatk1.0-0, libc6, libcairo-gobject2, libcairo2, libfontconfig1, libgcc1, libgdk-pixbuf2.0-0, libgl1, libglew2.1, libglib2.0-0, libgtk-3-0, libjpeg62-turbo, libpango-1.0-0, libpangocairo-1.0-0, libpng16-16, libpulse0, libreadline7, libstdc++6, zlib1g' --nodoc make install
```

The last two commands will take a while, but afterwards VICE should be installed.

## Project Configuration

After installing go to your launch.json and create a new section using the
snippet. If you don't have a launch.json, the "create a launch.json file" link
in the debug section should create a simple one.

<img src="https://github.com/empathicqubit/vscode-cc65-vice-debug/blob/master/images/config.png?raw=true" />

Obsolete settings:

- **viceCommand**: Please see the setting `cc65vice.viceDirectory` in your user settings.

Required settings for both launch and attach:

- **name**: The name in the debug dropdown menu.
- **request**: `launch` will launch, `attach` will attach.
- **type**: Always `cc65-vice` for this debugger.
- **buildCwd**: The working directory for your build command. You need this for
attachment as well, so the debugger can find relative paths in your debug file.

Required for attach mode only:

- **attachPort**: The port to attach to in attach mode. This is the port
configured with VICE's `-binarymonitoraddress` option.

Required for launch mode only:

- **viceArgs**: You'll want to set your C64 model here, and any other special
hardware options that you need for your program. Either NTSC or one of the PAL
models (jap, drean, etc). Look at the VICE manual for the full list.
- **buildCommand**: Your actual build command. Defaults to make if unspecified.
[You will need to change your Makefile to support being debugged with this.](#changes-needed-to-your-makefile)
- **preprocessCommand**: The command used to generate the preprocessor `.i`
files, which are used by Clang instead of the `.c` and `.h` files if they are
available. Omitting this setting may cause the preprocessor files not to be
built, which could result in less accurate struct handling.

Other shared settings:

- **stopOnEntry**: This will break at the beginning of the program. Otherwise
it will continue automatically after the debugger connects.
- **stopOnExit**: This will break at the end of the program. Otherwise
it will terminate automatically.

Optional shared settings which may be helpful if things aren't working:

- **program**: Specify this if the debugger can't find your binary file. By
default it will look for a d81/d64 and if it can't find any a PRG. If you have
multiple of those types of files, it will try some fanciness to determine which
one is the "real" one, such as looking at the modification date and how many
files are in your disk image, but those may fail.
- **mapFile**: Manually specify the path of your map file. Use this if auto
detection fails. When this is unset it will look for a file in the same folder
as your program named PROGRAMNAME.map
- **debugFile**: Manually specify the path of your debug file. Use this if auto
detection fails. When this is unset it will look for a file in the same folder
as your program named PROGRAMNAME.dbg

There are also some user settings to note:

<img src="https://github.com/empathicqubit/vscode-cc65-vice-debug/blob/master/images/user_config.png?raw=true" />

- **cc65.viceDirectory**: Set this to specify the directory that contains the
VICE executables. You'll probably need this on Windows. If this is omitted then
it will look on the system PATH.
- **cc65.preferX64OverX64sc**: Set to true to use x64, which is not recommended.
- **cc65.disableMetrics**: This disables metric reporting, which tracks when the
extension is activated or a debug session is requested or fails.
- **cc65.runAhead**: When hitting a breakpoint, step ahead by one frame so that
any screen updates that may have been made become visible immediately.

You may have some problems with `autostart-warp` working correctly. The way
VICE detects this may be to blame. To turn it off, just add `+warp` and
`+autostart-warp` to your `viceArgs`:

```json
{
    ...
    "viceArgs": [
        "+autostart-warp", "+warp",
        "-model", "ntsc"
    ]
    ...
}
```

## Changes needed to your Makefile

If you've used the default `Makefile` at
[the CC65 project wiki](https://github.com/cc65/wiki/wiki/Bigger-Projects#the-makefile-itself),
it's recommended to use a [slightly modified Makefile](src/tests/simple-project/Makefile).
This Makefile contains targets to generate the preprocessor `.i` files, which
are easier for Clang to understand to help you [browse struct data](#changes-needed-to-your-system).
Otherwise you only need to add the `-g` option to your `CFLAGS` **and** `LDFLAGS`
variables at the top of the file.

If instead you made a custom Makefile, you will need to tell the linker that
you want a debug file and a map file. You would add the following options to
your linker:

```sh
-g -Wl "--mapfile,build/PROGRAMNAME.map" -Wl "--dbgfile,build/PROGRAMNAME.dbg"
```

Make sure that the paths on the files are in the same folder and have the same
name (minus the extension, of course) as your main program!

You will also need a target to generate the preprocessor `.i` files. The default
target is `preprocess-only`, but you can change the command used with the
`preprocessCommand` option.

If you have included any optimizations (`-Osir`) you should probably turn those
off, however, effort has been made to trace some of them.

You may also want to look at the [full Assembly project template](src/tests/asm-project), and the [C project template](src/tests/simple-project).

## Changes needed to your code

You can use the debugger to browse structs, but only if the bare struct definition
exists somewhere in your code. So this will work:

```c
struct blah {
    unsigned char field;
}
typedef struct blah blah;
```

This will **not** work:

```
typedef struct {
    unsigned char field;
} blah;
```

Also, do not name your typedefs differently than your struct. It hasn't been
tested it but I assume it will break.

## What works

- Starting the program and stopping at the beginning of main()
- Setting and consistently hitting breakpoints
- Stepping over lines.
- Stepping out of functions.
- Stepping into functions.
- Viewing structs (**You have to install clang tools on your PATH**)
- Local variables (except for the one on the bottom of the stack, since the
size can't be determined)
- Global variables (2B size is assumed since the size can't be easily discovered AFAIK)
- Registers
- Variable and memory drilldown. With any variable, even ones that were
determined to be a single byte, you can use it as a two byte pointer to jump to
other blocks of memory by expanding the dropdown triangle. Once you get to actual
memory, you'll get 8x16 bytes (128 bytes). You can expand a row of 8 bytes and
it will give you 8 options for pointer referencing (01,12,23,34,...) which you
can expand and get another 128 byte chunk of memory, and on and on forever...
- Pausing and resuming works pretty much as you might expect. If you pause in
the middle of a library function it will look strange but the state of VICE will
be okay, but that's pretty typical for this sort of thing (think Microsoft's
scary "no symbols for this file" window when you pause on a compiled DLL in VS proper).

## What's weird

- Array types

## Building

You will need node >=13, vscode >=1.42, pnpm >=5.5. Mocha Test Explorer extension is also recommended.

To build, run the following commands:

```sh
pnpm install --shamefully-hoist
pnpm package
```

## Contributing

All work happens on `master`, and releases are merged from pull requests using Google's Release Please. Commit messages should start with `fix:` for bug fixes or `feat:` for new features, which will appear as bullet points in the changelogs. You can only have one `fix:` or `feat:` per commit message, and it must be on the first line. Do not manually edit the version or the CHANGELOG, unless your name is `empathicqubit`. **Breaking changes** should use `fix!:` and `feat!:`. Force pushes occassionally happen on `master` because I forget to add the tags to my commit messages.

## Additional Credits (see also LICENSE.md)

* **Assembly syntax highlighting**: Borrowed from [tlgkccampbell/code-ca65](https://github.com/tlgkccampbell/code-ca65)
* **Icon**: Based on a character that appears on the box art for **Bug Blaster**.
