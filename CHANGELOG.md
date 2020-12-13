# Changelog
## [2.9.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v2.8.0...v2.9.0) (2020-12-13)


### Features

* Release test ([fc1e086](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/fc1e08642337de8c08d403ecbe1efc12aa8390ac))


### Bug Fixes

* Test fix ([44d6521](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/44d6521f2d93537b80cffd5f973e371845f60c87))
* Update token ([d09762b](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/d09762bdf014b68885ccb9ea26a87d763162294a))

## [2.8.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v2.7.0...v2.8.0) (2020-12-12)


### Features

* Feature test ([cd3f1e8](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/cd3f1e8bd2df0f55f330a647516560d6e8189a3c))


### Bug Fixes

* I added a fix ([2e58b94](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/2e58b94fd328bd63d82e8db9e1f955eeb2423bfc))

## [2.7.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v2.6.0...v2.7.0) (2020-12-12)


### Features

* Feature test again ([dc3bb6d](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/dc3bb6dc88c9c6e1ed8125076e4d6eaf54d575ac))


### Bug Fixes

* Add release path ([3448519](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/34485190754660cc75d0ff5718a8a7c10c584d94))
* Another fix test ([03a1eb9](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/03a1eb95329dd6d0fe8088fd70835f41266fa310))
* major minor patch ([828c040](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/828c040f46af57f13d3168ff0c8c5c36ee05ee2c))

## [2.6.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v2.5.3...v2.6.0) (2020-12-12)


### Features

* This is a feature test ([00fc3e0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/00fc3e06fcb7928fab3a9dca6bd8d58c0d8a9036))

## 2.5.3
* More memory optimizations.

## 2.5.2
* Various memory and performance optimizations.

## 2.5.1
* Better breakpoint handling. Fix some issues with breakpoints disappearing
and batch the deletions / adds.
* Fix autoloading labels with -moncommands

## 2.5.0
* Fix serious regression with local variables. Add test to assert variables
are working properly.

## 2.4.6
* Use popups for a lot of messages so it's easier to notice them.
* Focus the monitor terminal after startup
* Name all the terminals
* Match the exact line when a new function is entered in the stack instead of the top of the function.

## 2.4.4

* Fix an issue with stepping through breakpoints.
* Step works in assembly files

## 2.4.3

* Added basic keyboard support to run window. Tab key is C=

## 2.4.2

* Added stop on exit

## 2.4.1

* Fix terminate

## 2.4.0

* Attach mode
* Change required version of VICE to r38635

## 2.3.0

* Less detailed trace information in the monitor output.

## 2.2.0

* Fixed an issue that caused the debugger not to launch at all.

## 2.1.0

* Faster startup by doing more operations in parallel.
* Improved syntax highlighting.

## 2.0.1

* Implement binary monitor protocol, remove most text based commands.
* Better event handling and async due to above.
* Run ahead function to preview the next frame. Enabled by default.
* Remove viceCommand from launch configuration and put into global settings as viceDirectory.
* Use injection for PRG loads instead of fake disk. More secure than virtualFS,
less wonky than disk.
* Better handling of tail call optimizations introduced by `-Or`.
* Better behavior when step out fails.
* Better breakpoint handling.
* Include support for other VICE machines such as C128, PET, etc.
* Use pnpm for package management.
* Custom version of vsce to work with pnpm.

## 1.1.24

* Prevent runaway step in when there's no function to step into.

## 1.1.23

* Use stack frames for more accurate step in.

## 1.1.22

* Work around VICE bug with getting single byte.

## 1.1.21

* Autostart using the monitor command, instead of passing at the command line.

## 1.1.20

* Fix local variable size calculation.

## 1.1.19

* Added a warning about adding the correct debug options if they're missing.

## 1.1.18

* Better draining of the connection to fix some synchronization issues.

## 1.1.17

* Fix some Windows-specific startup issues.

## 1.1.16

* Increase stability of startup and use a custom Kernal to decrease load time.

## 1.1.15

* Show contents of static variables when --static-locals is enabled

## 1.1.14

* Change the way the CODE segment is handled so assembly-only programs work better.
* Add details about requiring the `-g` option to the README.

## 1.1.13

* Automatically load label file into monitor if it exists.
