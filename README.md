# vscode-cc65-vice-debug

[![Version](https://vsmarketplacebadge.apphb.com/version/entan-gl.cc65-vice.svg)](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/entan-gl.cc65-vice.svg)](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating/entan-gl.cc65-vice.svg)](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)

In progress debugger extension to allow vscode to interact with VICE and CC65.

[Install it here](https://marketplace.visualstudio.com/items?itemName=entan-gl.cc65-vice)

<img src="https://github.com/empathicqubit/vscode-cc65-vice-debug/blob/master/images/action.png?raw=true" />

<a target="_blank" href="https://donorbox.org/cc65-vice-debugger?default_interval=o"><img src="https://d1iczxrky3cnb2.cloudfront.net/button-small-green.png" /></a>

## Setup

After installing go to your launch.json and create a new section using the snippet. If you don't have a launch.json, the "create a launch.json file" link in the debug section should create a simple one.

<img src="https://github.com/empathicqubit/vscode-cc65-vice-debug/blob/master/images/config.png?raw=true" />

There are a few settings in this configuration to note:

- **viceCommand**: **OBSOLETE**! Please see the setting `cc65vice.viceCommand` in your user settings. Set this to specify the path to the VICE executable. You'll probably need this on Windows.
- **viceArgs**: You'll want to set your C64 model here, and any other special hardware options that you need for your program. Either NTSC or one of the PAL models (jap, drean, etc). Look at the VICE manual for the full list.
- **buildCommand**: Your actual build command. Defaults to make if unspecified. [You will need to change your Makefile to support being debugged with this.](#changes-needed-to-your-makefile)
- **preprocessCommand**: The command used to generate the preprocessor `.i` files, which are used by Clang instead of the `.c` and `.h` files if they are available. Omitting this setting may cause the preprocessor files not to be built, which could result in less accurate struct handling.
- **program**: Specify this if the debugger can't find your binary file. By default it will look for a d81/d64 and if it can't find any a PRG. If you have multiple of those types of files, it will try some fanciness to determine which one is the "real" one, such as looking at the modification date and how many files are in your disk image, but those may fail.
- **type**: Always `cc65-vice` for this debugger.
- **request**: Always launch. Attachment is not possible yet.
- **name**: The name in the debug dropdown menu.
- **buildCwd**: The working directory for your build command.
- **stopOnEntry**: This will break at the beginning of the program. Otherwise it will continue automatically after the debugger connects.

You may have some problems with `autostart-warp` working correctly. The way VICE detects this may be to blame. To turn it off, just add `+warp` and `+autostart-warp` to your `viceArgs`:

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

If you've used the default `Makefile` at [the CC65 project wiki](https://github.com/cc65/wiki/wiki/Bigger-Projects#the-makefile-itself), it's recommended to use a [slightly modified Makefile](src/tests/simple-project/Makefile). This Makefile contains targets to generate the preprocessor `.i` files, which are easier for Clang to understand to help you [browse struct data](#changes-needed-to-your-system). Otherwise you only need to add the `-g` option to your `CFLAGS` **and** `LDFLAGS` variables at the top of the file. 

If instead you made a custom Makefile, you will need to tell the linker that you want a debug file and a map file. You would add the following options to your linker:

```sh
-g -Wl "--mapfile,build/PROGRAMNAME.map" -Wl "--dbgfile,build/PROGRAMNAME.dbg"
```

Make sure that the paths on the files are in the same folder and have the same name (minus the extension, of course) as your main program!

You will also need a target to generate the preprocessor `.i` files. The default target is `preprocess-only`, but you can change the command used with the `preprocessCommand` option.

If you have included any optimizations you should probably turn those off, however, efort has been made to trace some of them.

## Changes needed to your system

It's not required, but if you install Clang tools you can get details on struct fields. To do that on Debian (stretch):

```sh
sudo apt install clang-tools-7
```

You might need to poke around with the version until you find one that exists with your distribution.

## Changes needed to your code

You can use the debugger to browse structs, but only if the bare struct definition exists somewhere in your code. So this will work:

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

Also, do not name your typedefs differently than your struct. It hasn't been tested it but I assume it will break.

## What works

- Starting the program and stopping at the beginning of main()
- Setting and consistently hitting breakpoints
- Stepping over lines.
- Stepping out of functions.
- Stepping into functions.
- Viewing structs (**You have to install clang tools on your PATH**)
- Local variables (except for the one on the bottom of the stack, since the size can't be determined)
- Global variables (2B size is assumed since the size can't be easily discovered AFAIK)
- Registers
- Variable and memory drilldown. With any variable, even ones that were determined to be a single byte, you can use it as a two byte pointer to jump to other blocks of memory by expanding the dropdown triangle. Once you get to actual memory, you'll get 8x16 bytes (128 bytes). You can expand a row of 8 bytes and it will give you 8 options for pointer referencing (01,12,23,34,...) which you can expand and get another 128 byte chunk of memory, and on and on forever...
- Pausing and resuming works pretty much as you might expect. If you pause in the middle of a library function it will look strange but the state of VICE will be okay, but that's pretty typical for this sort of thing (think Microsoft's scary "no symbols for this file" window when you pause on a compiled DLL in VS proper).

## What's weird

- Array types

## Additional Credits (see also LICENSE.md)

* **Assembly syntax highlighting**: Borrowed from [tlgkccampbell/code-ca65](https://github.com/tlgkccampbell/code-ca65)
