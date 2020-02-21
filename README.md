# vscode-cc65-vice-debug

In progress debugger extension to allow vscode to interact with VICE and CC65.

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
