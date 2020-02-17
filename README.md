# vscode-cc65-vice-debug

In progress debugger extension to allow vscode to interact with VICE and CC65.

## What works

- Starting the program and stopping at the beginning of main()
- Setting and consistently hitting breakpoints
- Local variables (except for the one on the bottom of the stack, since the size can't be determined)
- Global variables (2B size is assumed since the size can't be easily discovered AFAIK)
- Registers
- Variable and memory drilldown. With any variable, even ones that were determined to be a single byte, you can use it as a two byte pointer to jump to other blocks of memory by expanding the dropdown triangle. Once you get to actual memory, you'll get 8x16 bytes (128 bytes). You can expand a row of 8 bytes and it will give you 8 options for pointer referencing (01,12,23,34,...) which you can expand and get another 128 byte chunk of memory, and on and on forever...
- Pausing and resuming works pretty much as you might expect. If you pause in the middle of a library function it will look strange but the state of VICE will be okay, but that's pretty typical for this sort of thing (think Microsoft's scary "no symbols for this file" window when you pause on a compiled DLL in VS proper).

## What's weird

- I recently **changed the terminal** to use a nativish one. I like it because I can support colors and graphics characters (reinterpreting the output of the VICE monitor), but it's still a work in progress. Older versions using the console worked better than the current one and prevented you from doing stupid things like messing with checkpoints.
- The **interface doesn't always recognize that you've hit the first breakpoint**. Messing with the terminal fixes it, but it used to work correctly. I think I messed something up when switching to the terminal over the console.
- The **terminal uses ncat** which isn't a cross platform solution, but I was developing quickly. It could be replaced with literally anything else, probably a Node script. Some other programs such as VICE are using plain commands without absolute paths so will probably break on Windows. I intend to fix but it's not been a priority while I've been developing.
- The **variable drilldown** is nice but isn't as useful as for example, being able to **understand structs in memory**. Unfortunately it doesn't seem that the debug symbols contain any information about the shape of the structs, so I'll probably need to hand parse the code, but that seems like a PITA. I found a few libraries for doing this in Node, but they either a) suck, or b) use clang, which will **cause native dependency headaches I don't want to deal with**. I'm on Debian Stretch and I can't even install clangd easily.
- The **call stack frames** don't always clean themselves up and keep building up in the sidebar until the list is miles long. I've noticed a few weird things about the debug symbols that could be an issue. The scopes don't always refer to the function they're named after exactly. Still not sure why. The labels are usually more accurate, but even using those causes issues occassionaly. Bad maths? Also, they don't reference the point where the function was jumped out of, they reference the beginning of the function, which makes things a little harder to follow.
- **Step over** works enough that I know I can get it to usable, but sometimes it inexplicably skips over lines. I think it may have to do with reordering that the compiler performs. It probably would make sense to set a range checkpoint out from that line to the end of the function or the memory so the debugger can't run away if something goes wrong.
- **Step in** works some of the time. Sometimes you'll get flown off to nowwhereville
- **Step out** is an absolute mess. It'll teleport you into walls and eat your cat, and by that I mean that it will seem to drop you onto a completely unrelated line in the program. What's actually happening here is that VICE is perfectly fine, but the location reported is inside a library function. This isn't necessarily wrong behavior, and it also does this frequently when you pause the debugger. Clarifying when we don't have a good idea of where we are would be helpful.

## TODO

- [ ] Fix the PETSCII->Unicode interpretation in the terminal.
- [ ] Fix the initial break
- [ ] Speed up the startup time. Not bad but could be better.
- [ ] Make structs easily navigable.
- [ ] Fix the call stack frames. Make them refer to the scope exit point, even in the middle of the function.
