# vscode-cc65-vice-debug

In progress debugger extension to allow vscode to interact with VICE and CC65.

## Setup

After installing go to your launch.json and create a new section using the snippet. If you don't have a launch.json, the "create a launch.json file" link in the debug section should create a simple one.

<img src="https://github.com/empathicqubit/vscode-cc65-vice-debug/images/config.png" />

There are a few settings in this configuration to note:

- **viceCommand**: You'll most likely need this if you're working on Windows. This is the full path to either x64sc (recommended) or x64 (not recommended, but possible). If this is not included, the debugger will try to start x64sc, and then x64 at the default PATH. If it can't find either it will complain.
- **buildCommand**: Your actual build command. Defaults to make if unspecified. You will need to change your Makefile to support being debugged with this (see below), unless you've used the CC65 example one documented at [https://github.com/cc65/wiki/wiki/Bigger-Projects](the CC65 project wiki)
- **program**: Specify this if the debugger can't find your binary file. By default it will look for a d81/d64 and if it can't find any a PRG. If you have multiple of those types of files, it will try some fanciness to determine which one is the "real" one, such as looking at the modification date and how many files are in your disk image, but those may fail.
- **type**: Always `cc65-vice` for this debugger.
- **request**: Always launch. Attachment is not possible yet.
- **name**: The name in the debug dropdown menu.
- **buildCwd**: The working directory for your build command.
- **stopOnEntry**: This will break at the beginning of the program. Otherwise it will continue automatically after the debugger connects.

## Changes needed to your Makefile

If you've used the default Makefile at [https://github.com/cc65/wiki/wiki/Bigger-Projects](the CC65 project wiki) then you shouldn't need to change anything. Otherwise, you will need to tell the linker that you want a debug file and a map file. you would add the following options to your linker:

```sh
-Wl "--mapfile,build/PROGRAMNAME.map" -Wl "--dbgfile,build/PROGRAMNAME.dbg"
```

Make sure that the paths on the files are in the same folder and have the same name (minus the extension, of course) as your main program!

## What works

- Starting the program and stopping at the beginning of main()
- Setting and consistently hitting breakpoints
- Stepping over lines.
- Stepping out of functions.
- Local variables (except for the one on the bottom of the stack, since the size can't be determined)
- Global variables (2B size is assumed since the size can't be easily discovered AFAIK)
- Registers
- Variable and memory drilldown. With any variable, even ones that were determined to be a single byte, you can use it as a two byte pointer to jump to other blocks of memory by expanding the dropdown triangle. Once you get to actual memory, you'll get 8x16 bytes (128 bytes). You can expand a row of 8 bytes and it will give you 8 options for pointer referencing (01,12,23,34,...) which you can expand and get another 128 byte chunk of memory, and on and on forever...
- Pausing and resuming works pretty much as you might expect. If you pause in the middle of a library function it will look strange but the state of VICE will be okay, but that's pretty typical for this sort of thing (think Microsoft's scary "no symbols for this file" window when you pause on a compiled DLL in VS proper).

## What's weird

- The **variable drilldown** is nice but isn't as useful as for example, being able to **understand structs in memory**. Unfortunately it doesn't seem that the debug symbols contain any information about the shape of the structs, so I'll probably need to hand parse the code, but that seems like a PITA. I found a few libraries for doing this in Node, but they either a) suck, or b) use clang, which will **cause native dependency headaches I don't want to deal with**. I'm on Debian Stretch and I can't even install clangd easily.
- **Step in** works some of the time. Sometimes you'll get flown off to nowwhereville

## TODO

- [ ] Fix the initial break
- [ ] Speed up the startup time. Not bad but could be better.
- [ ] Make structs easily navigable.
