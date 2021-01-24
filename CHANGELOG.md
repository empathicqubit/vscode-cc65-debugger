# Changelog

### [3.7.3](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.2...v3.7.3) (2021-01-24)


### Bug Fixes

* Don't handle events from other debuggers, ya duh ([2995c32](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/2995c32ba81801c7912f5c490d68ec9678c9e36e))

### [3.7.2](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.1...v3.7.2) (2021-01-24)


### Bug Fixes

* Better handling of non-C64 system files ([0bb3a4b](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/0bb3a4bf15570200bdc8296197d9f82efa406db0))
* Make attach detection more reliable. ([8f4b4eb](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/8f4b4eb0cbfcef759823baa4b95d180b18e63a73))
* Test PET. Properly handle debug and map file launch args ([ae5c645](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/ae5c645b04d583ddd2d41eed25edc14fdb343d42))

### [3.7.1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.0...v3.7.1) (2021-01-09)


### Bug Fixes

* Handle lower charset correctly ([5b487e9](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/5b487e9d26f339ab9fb05201e1f79288155186a6))

## [3.7.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.6.0...v3.7.0) (2021-01-08)


### Features

* Ability to toggle between graphics and lower charsets. ([bfbf15c](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/bfbf15cd372772e07d6c091b6e7d031865359b17))

## [3.6.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.5.1...v3.6.0) (2021-01-05)


### Features

* Added memory tab ([9616938](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/961693865fa7f6a670bc6a281e1ee2415d20ad24))
* Allow color selection for sprites on memory tab. ([fc11cf6](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/fc11cf65d38cfc8a998fe0ddb13469ce82e66760))
* Bank selection for memory viewer ([36a388d](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/36a388d7490d26bf86377e3fa771898d0c5c7afc))
* Screen code text on memory screen ([05e5e77](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/05e5e77b2c525c686763f5778c2ff2f17fbaf048))
* View any part of memory as an array of sprites ([5fd9f17](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/5fd9f17f42983b094a6784e0554d207e81473123))


### Bug Fixes

* Prevent control before the session is fully setup ([8c5c1a0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/8c5c1a0c8d519410c795073d9afd75a1628824a8))

### [3.5.1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.5.0...v3.5.1) (2021-01-01)


### Bug Fixes

* Fix syntax file ([2147d46](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/2147d46dddfcd0c35307601b4b19c0bc61e41ed0))

## [3.5.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.4.0...v3.5.0) (2020-12-31)


### Features

* Add screen text viewer ([f5c5b63](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/f5c5b63a8c67808db36db359e9460bae7b9e1561))
* Add sprite viewer. ([8bb2797](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/8bb27978c9a74f726c62250483145be2356dddc6))
* Reduce extension size. ([b3c44b1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/b3c44b1094f5e9b36c07ac6be86e1fdf9a84166f))
* Update project templates to suggest installing the debugger ([c94a81e](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/c94a81ee8edba0769f50c66b33b704a55d5add5b))


### Bug Fixes

* Don't fail if Clang isn't installed ([18e8b1b](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/18e8b1b4bc91c8d05d063cca30e19bbef9e67ce6))
* Don't fail if there are no c files in the project. ([42aedb0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/42aedb0213ce82ed78ff9befb20a5921ac132d3b))
* Update registers during startup sequence ([a44e74e](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/a44e74e072f771bc1eeb01d36acb1b64295d1256))

## [3.4.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.3.0...v3.4.0) (2020-12-27)


### Features

* Recognize Clang 11/12 if installed ([6f5c71e](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/6f5c71e360a5f66c4f8eb6ab6def73405fc6860c))


### Bug Fixes

* Autostart works correctly again ([ec7a5bc](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/ec7a5bcc7abbece4d668e5a50894f1dc302126ea))
* Terminate actually closes window again ([52567d2](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/52567d25864c63439dbbea276dd1ed6f09e4face))

## [3.3.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.2.0...v3.3.0) (2020-12-24)

### ⚠ BREAKING CHANGES

* Update API calls to work with latest VICE nightly

### Features

* Publish releases automatically ([f6ddead](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/f6ddead0b874bf1a951f7dadbefabb8023764fc5))
* Update to VICE 3.5 ([bcc5cac](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/bcc5cace5cee7a56d5966806a8db7681fe6b0e44))
* Better Assembly file handling ([f8c2415](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/f8c2415a4ebb6302b121d0170b06106142d0c337))
* Update API calls to work with latest VICE nightly ([c22d5b2](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/c22d5b282dc00e1d6837e87189cf825a6cc482e9))

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
