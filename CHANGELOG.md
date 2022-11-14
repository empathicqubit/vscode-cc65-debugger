# Changelog

### [6.6.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.6.1...v6.6.2) (2022-11-14)


### Bug Fixes

* Partially fix NES ([2bd296e](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/2bd296eab5c71c874ec055977742284912d240b5))

### [6.6.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.6.0...v6.6.1) (2022-11-14)


### Bug Fixes

* Check the function binaries on startup, to avoid false starts. ([b32003d](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/b32003dbbdf13bd40eedb37ed92974bc5cc982e2))
* Fix an issue with step out using a temp breakpoint ([2f926b0](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/2f926b068b9ca8eed282b99bfb29478c7298b74f))

## [6.6.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.5.0...v6.6.0) (2022-11-08)


### Features

* Add syntax highlighting for debug, map, and label files ([f64a939](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f64a93975509f56ad9ad3fe588fe604c56079786))

## [6.5.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.4.0...v6.5.0) (2022-11-08)


### Features

* Basic disassembly view ([258db5b](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/258db5bc3ce8e9dd4bcf8a545e866b75a04e8c76))


### Bug Fixes

* fix an issue with palette loading on the sprite tab ([350bb4f](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/350bb4f6a922f44723ed1b289d7a123a62dbde85))
* Post a warning about unreliable variable values. ([4a19928](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/4a199288570b4d95f736c59765ed032d6875f630))

## [6.4.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.3.7...v6.4.0) (2022-11-01)


### Features

* Add devcontainer.json for easier development in Codespaces ([09102eb](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/09102eb9d4cc6476829bd9796d2e1d454598f8c8))

### [6.3.7](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.3.6...v6.3.7) (2022-10-29)


### Bug Fixes

* Fix problem with UI styling and loading ([9f65493](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/9f654939ff34425ba0b167e9a9fca5d4d79f7c45))

### [6.3.6](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.3.5...v6.3.6) (2022-10-13)


### Bug Fixes

* Force rerender when visible text editor changes ([043c76d](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/043c76d67c374f068dad63071709b41f0085c099))

### [6.3.5](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.3.4...v6.3.5) (2022-10-13)


### Bug Fixes

* Cache the program data file ([5ac2003](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5ac2003e99e7f114e292d7e7338986c9de38eb4c))

### [6.3.4](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.3.3...v6.3.4) (2022-10-13)


### Bug Fixes

* Invalidate cycle counts if debug file is updated ([a983da1](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/a983da13c0f568faa8ee957f1c5a1e76badd4355))

### [6.3.3](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.3.2...v6.3.3) (2022-10-12)


### Bug Fixes

* catch errors on termination ([1f19c30](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/1f19c306cc9fc3f43253a6e618f5353daf6031d4))
* Update decorations frequently based on document version change ([a758c06](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/a758c06fecafef59bf9a0cd1546ebe15c83c12d3))

### [6.3.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.3.1...v6.3.2) (2022-05-29)


### Bug Fixes

* Properly handle appleWinDirectory setting ([5d76517](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5d76517ef56fa2e1e0f7ec6d386103384b070947))
* Remove weird logging on Windows and replace with minTTY ([be273ed](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/be273edd63d565522cc3f4d624abb73323c0a602))

### [6.3.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.3.0...v6.3.1) (2022-05-28)


### Bug Fixes

* Require vscode >=1.62 and remove note from README about 1.67 ([5f98f3f](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5f98f3f6636db61ae6040416bcd01d7c3338bc62))

## [6.3.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.2.1...v6.3.0) (2022-05-28)


### Features

* add option to manually specify machine type to use. ([dd54b59](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/dd54b597f0adea7372fa01ad79a2d1b5a56dc76b))


### Bug Fixes

* Fix issue with CLI escaping on 1.67 [#114](https://www.github.com/empathicqubit/vscode-cc65-debugger/issues/114) ([cd5423f](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/cd5423fc7f82871de71dbb446bdb8fcb878d8a42))

### [6.2.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.2.0...v6.2.1) (2022-05-23)


### Bug Fixes

* Add note about issues with VSCode 1.67. ([2514fb0](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/2514fb0409529b4fad06d7da69d17d93646c3411))

## [6.2.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.1.3...v6.2.0) (2022-05-22)


### Features

* Add Apple2 dsk support ([208fdb5](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/208fdb5733ae3956af315d4f392b867fca8845dc))


### Bug Fixes

* Cleanup background breakpoints when disconnecting ([7374f6e](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/7374f6ee97cf9abe6ce0acef78b5ceac7bd7e848))
* Copy kernal mod to new kernal files ([c8e06c3](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/c8e06c344ca6be9014c9429510c17399e9a22f5e))
* Disable runahead always for NES and Apple2, since it's broken ([7e59eea](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/7e59eea711775d9008315e92b002beb3efee2f6e))
* Disable runahead for every platform except C64 ([04e10b1](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/04e10b11ad19bbe7c8962bfb1bda0b753f88480c))
* Fix issue with output redirection which breaks vsc 1.67.2 [#112](https://www.github.com/empathicqubit/vscode-cc65-debugger/issues/112) ([31de012](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/31de0121bee8ba69e1b8563581d21a2a73337d28))
* Remove user breakpoints on detach ([76179d5](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/76179d5d7e6927ccc41e207d05c81d938de53766))
* Update VICE data folder ([aa5226d](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/aa5226d5a4cb2f161dfd0f3cebfe3733895770a4))

### [6.1.3](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.1.2...v6.1.3) (2022-03-27)


### Bug Fixes

* Add stupid switch to Windows build entrypoint. ([1fbed54](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/1fbed54c9a1a58191a81ddc91fe876fb2d1204f0))
* Note about rating on Marketplace ([0d1da34](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/0d1da34fb56d7a39bfa569a55b853fc35b822fc7))

### [6.1.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.1.1...v6.1.2) (2022-02-22)


### Bug Fixes

* colors vulnerability fixed because people suck ([0ada0f6](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/0ada0f60fc75448d4796803b33e0b6a956c29e03))
* Properly handle VSCode not being installed on nixen. ([cc270dd](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/cc270dd393454b0b9d20511a32a157d3bf7da3f5))
* Run window is no longer blank. ([24b03ff](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/24b03ffdc0dbb46b3397174eceda022f58d61710))

### [6.1.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.1.0...v6.1.1) (2022-02-20)


### Bug Fixes

* Fix project build scripts ([5dff50a](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5dff50ae99037c01f910cf0a335f4bf838e19325))

## [6.1.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v6.0.0...v6.1.0) (2022-02-19)


### Features

* Include Darwin cc65 in extension ([b8665c2](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/b8665c2e091871a6d8c195ee0bf3128c5cf23a59))

## [6.0.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.1.4...v6.0.0) (2022-02-19)


### ⚠ BREAKING CHANGES

* Remove official support for VICE 3.5. It still works for now.

### Features

* Remove official support for VICE 3.5. It still works for now. ([5b7ea18](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5b7ea18f4cad92a4f97636b959f901301c2579ad))
* Unofficial CC65 Darwin support for extension development only. ([008e139](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/008e139751a1e5fadbeebb4d4d15b6ae741a8392))

### [5.1.4](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.1.3...v5.1.4) (2022-02-06)


### Bug Fixes

* TypeError when launching emulators on Windows ([390d66f](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/390d66f8b5273faa1a626835ca38f45988c716ad))

### [5.1.3](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.1.2...v5.1.3) (2022-01-16)


### Bug Fixes

* Include '.exe' suffix on Windows ([cd718ae](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/cd718aed9612dc4ba7f7de25c54206a084a17f09))
* Version detection works correctly for 3.6 ([bc7c971](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/bc7c97182b95915bd6cf963dc99c6dfabfff074a))

### [5.1.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.1.1...v5.1.2) (2021-11-27)


### Bug Fixes

* Add joyport control and fix keyboard event detection. ([7fb1f9d](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/7fb1f9dd587c3c6df8aaad60db37890ef78daeb4))

### [5.1.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.1.0...v5.1.1) (2021-11-26)


### Bug Fixes

* Properly display NES screen ([1ad8f23](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/1ad8f23ae1925e5eada1da0c6428980d1dd7d307))
* Reset Mesen-X after connecting ([8546531](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/8546531561197182a3dd43b945a51414fb538963))

## [5.1.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.0.6...v5.1.0) (2021-11-25)


### Features

* Switch to Mesen-X and update driver. Thanks @AlchemicRaker ([872f7c8](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/872f7c8d1c145200cd01c6658d11627e759dd768))

### [5.0.6](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.0.5...v5.0.6) (2021-11-22)


### Bug Fixes

* Windows does not need extra double quotes. Thanks [@nickbungus](https://www.github.com/nickbungus) ! ([7b6cc47](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/7b6cc479184afee3bbec197678ca4f24a123c4ca))

### [5.0.5](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.0.4...v5.0.5) (2021-11-20)


### Bug Fixes

* Rename make scripts in project template to mk ([fdcc30d](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/fdcc30db3c37c86fd51c1598c21d8dd020190e02))
* Use the correct name for the asm-project program ([69d145f](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/69d145f823cbb0577840b767dd445fd1ca7ca9c1))

### [5.0.4](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.0.3...v5.0.4) (2021-11-19)


### Bug Fixes

* Change the program name for all project templates ([a58489f](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/a58489faca974d0ef8659c952cc7e0390509973d))

### [5.0.3](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.0.2...v5.0.3) (2021-11-19)


### Bug Fixes

* Binary file is always called program by default. ([de95937](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/de95937768bc1d4b3decfa31974593c9fefd7901))

### [5.0.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.0.1...v5.0.2) (2021-11-19)


### Bug Fixes

* Completely remove autodetect and force the program to be specified. ([7e3b3cf](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/7e3b3cf382ee525a9825cba0057e9c51c106f521))

### [5.0.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v5.0.0...v5.0.1) (2021-11-19)


### Bug Fixes

* Don't include NES in the project template by default. ([41a71e3](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/41a71e30a7a0c95064b8dde5d59bc776f8f9a4b4))

## [5.0.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.10.2...v5.0.0) (2021-11-05)


### ⚠ BREAKING CHANGES

* Change launch arguments to reflect multiple emulators.

### Features

* Change launch arguments to reflect multiple emulators. ([441e51c](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/441e51cf726afb7a6d67651ae6fe9ea900da8df8))
* NES support with Mesen ([e139c20](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/e139c20d639f38592eccda024e92bc0a0fac56a4))


### Bug Fixes

* Doubled up home path on Windows ([aa42bc0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/aa42bc038452244dba62680914f7a7ff9044109f))
* issue with Windows file formatting with table files ([3b95aa1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/3b95aa10a5e6ff184826c6444c1d057101f61406))
* Remove dither field from palette command ([1f02d52](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/1f02d52d9b0d31a94ebd66e8b17bc5a506a80a03))

### [4.10.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.10.1...v4.10.2) (2021-10-20)


### Bug Fixes

* Output event should always include text. ([e24cf19](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/e24cf199ba2df06d06cc84eef82fb52e4a2d3ae8))

### [4.10.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.10.0...v4.10.1) (2021-10-19)


### Bug Fixes

* Do not broadcast UI events unless requested. ([346857c](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/346857cb428f3d6c2f7dc94a8e0106c516ab7144))

## [4.10.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.9.1...v4.10.0) (2021-10-19)


### Features

* Allow skipping the build process for launch. ([0d0d3a0](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/0d0d3a0d4f7ccc0dd37d95c6f16423e585a4adc3))

### [4.9.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.9.0...v4.9.1) (2021-10-13)


### Bug Fixes

* Prevent a broken value render from breaking the entire list. ([59fa50d](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/59fa50d50f0658a152e6b7e4de510f3e504c6b01))

## [4.9.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.8.2...v4.9.0) (2021-10-11)


### Features

* Set global variables ([d4196fb](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/d4196fbe93601c85296e2a1d63765668a684c74f))
* Set the registers through the UI. ([cb4df33](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/cb4df33a2277de8dadd951838cf08e4d76ca07c7))


### Bug Fixes

* Global types work more reliably. ([b6beae2](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/b6beae2b262c2cceec901bf2a7eeaf6a7898e3cd))

### [4.8.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.8.1...v4.8.2) (2021-10-10)


### Bug Fixes

* Properly display the direct memory address. ([7d369ad](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/7d369adb31eab554cc3733c7ba4f6304ac567243))

### [4.8.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.8.0...v4.8.1) (2021-10-07)


### Bug Fixes

* Add timeout to event silencing so the debugger isn't stuck permanently. ([c6a18f2](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/c6a18f2231dd2ae13c721c9926e7ac876784d02e))

## [4.8.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.7.4...v4.8.0) (2021-10-06)


### Features

* Show rasterline over display ([f65912d](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f65912d72adeb344faff791ce00dad7fda9b7df2))


### Bug Fixes

* Timeout the VICE lock so that a stuck command can't break the app. ([0a986fa](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/0a986fabd43a2d5608e906ad9fad7a0d17cf9f5f))

### [4.7.4](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.7.3...v4.7.4) (2021-10-04)


### Bug Fixes

* Include preassigned statics. ([5b98b99](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5b98b9920c96f450392f897adc80d0772a87cbbb))

### [4.7.3](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.7.2...v4.7.3) (2021-10-04)


### Bug Fixes

* Move action image to the top of the README ([4d5e643](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/4d5e643622fff0756016f643937f2b861a6777ac))

### [4.7.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.7.1...v4.7.2) (2021-10-04)


### Bug Fixes

* Update gif to show off expression features. ([fd68d01](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/fd68d016970956c1e5f05a6ec5f3c7435011a70b))

### [4.7.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.7.0...v4.7.1) (2021-10-04)


### Bug Fixes

* Event handling was breaking sprites. ([2f4cb79](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/2f4cb79f0087ba94886a86398687e4590c2914eb))

## [4.7.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.6.2...v4.7.0) (2021-10-04)


### Features

* Conditional breakpoints work to a small extent. ([28e90ee](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/28e90ee135fb230387a38670f9b3fa15a014dc6d))
* Evaluate log message breakpoints ([c082da6](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/c082da6c798ad71bd0ec8753d393c3a321257370))

### [4.6.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.6.1...v4.6.2) (2021-10-04)


### Bug Fixes

* Setting a breakpoint doesn't cause the execution cursor to flash. ([9c1d14e](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/9c1d14edd4c1363edb7f3b0d566e7e9c100aa2ba))

### [4.6.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.6.0...v4.6.1) (2021-10-03)


### Bug Fixes

* Actually add build entrypoint to zip ([3457391](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/3457391cd40aa1be5a4d178b49e18a1018450ad8))

## [4.6.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.5.1...v4.6.0) (2021-10-03)


### Features

* Added scripts to allow running builds in proper context. ([86b0b0e](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/86b0b0ebe5e366b569e8c310d5287106fa861435))

### [4.5.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.5.0...v4.5.1) (2021-10-02)


### Bug Fixes

* If we can't find any exit addresses, use the CPU stack. ([5e62f49](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5e62f4983175fea00fde36262756bc92ccbca7c9))
* Step out at end of function. Fix assembly step out. ([b48c2cc](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/b48c2ccc7235ca8d082ba331392e8ffe68a691fe))

## [4.5.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.4.2...v4.5.0) (2021-09-30)


### Features

* Enhance hover behavior and allow expressions on debugging console ([f075606](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f075606abdc91acf50291e82e3c4d20e97c4df25))

### [4.4.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.4.1...v4.4.2) (2021-09-30)


### Bug Fixes

* Missing address offset for array values. ([573281f](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/573281fda81425615d35c29d02d746ca94341db1))

### [4.4.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.4.0...v4.4.1) (2021-09-30)


### Bug Fixes

* Use common value rendering code for array values. ([34b6581](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/34b6581e56c6186908053af4d1148f44c55b34e5))

## [4.4.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.3.1...v4.4.0) (2021-09-30)


### Features

* Add variable section for statics. ([f75f4bc](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f75f4bc42809a4ffef91cb3bd3f77284ed5225fa))

### [4.3.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.3.0...v4.3.1) (2021-09-29)


### Bug Fixes

* Handle union types correctly ([edbed02](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/edbed020585dddf7c26e7ba4d9a2032eaaf7ce45))

## [4.3.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.2.0...v4.3.0) (2021-09-29)


### Features

* Allow multi-selecting lines ([d181889](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/d1818899c9faf0672c21d456a1703b000624478d))


### Bug Fixes

* Honor cycle configuration at startup ([ddb5606](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/ddb560608175a6ee9a0f2e654624edf3e76f57c4))

## [4.2.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.1.7...v4.2.0) (2021-09-28)


### Features

* Line cycle counter ([0e18d91](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/0e18d9131257e0b7f19053040e14a7f3d0a51335))

### [4.1.7](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.1.6...v4.1.7) (2021-09-27)


### Bug Fixes

* Avoid jumping into macro files if higher level files exist. ([d387134](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/d3871345f62dc7a2a231665dc649d067e9ae247b))
* Kill old CI builds. ([5dd2ecf](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5dd2ecf9bd7a3eb3e478b7ebfd1c2dee8ce18474))


### Reverts

* Revert "remove weird job cancelly thing" ([71bb6f5](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/71bb6f552843943fedf3271901062d33aa0cb998))

### [4.1.6](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.1.5...v4.1.6) (2021-09-26)


### Bug Fixes

* Use correct symbol name for globals ([f2fa502](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f2fa502ae435ef81f6b09ee04f0ea7ce65903fef))

### [4.1.5](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.1.4...v4.1.5) (2021-09-26)


### Bug Fixes

* Make globals and locals use the same logic. ([6e20c59](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/6e20c59b9dd5cc16d941653939996a875294c34b))

### [4.1.4](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.1.3...v4.1.4) (2021-09-26)


### Bug Fixes

* Make tests work on the build server again ([8f02b90](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/8f02b909d644b9ab30c81a02998e2565920d014c))

### [4.1.3](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.1.2...v4.1.3) (2021-09-25)


### Bug Fixes

* Include c file first in the stack order. ([221e6d5](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/221e6d501496ea6b97afd3f1ac90211c92a838ef))
* Manual port specification in launch, sequential port assignment. ([749f3d4](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/749f3d4bef603719ebb246889f703fea1b242cad))

### [4.1.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.1.1...v4.1.2) (2021-09-23)


### Bug Fixes

* Better(?) icon ([f200c05](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f200c05067eca0cc9f61e06cfa26b0931f8929d7))

### [4.1.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.1.0...v4.1.1) (2021-09-23)


### Bug Fixes

* Add a connection timeout. ([5f11e12](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5f11e1292acd9148046dd3a89f57e3e968798f61))

## [4.1.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.0.4...v4.1.0) (2021-09-23)


### Features

* Add gitignore files for example projects ([99b3506](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/99b3506f7d1e52f410fef2a297a24f9144ed59d8))


### Bug Fixes

* Don't step through serial line accesses to avoid VICE bug ([d00cdb7](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/d00cdb7ef804884dd94ddbe096baa8c7b95ac3cc))
* Infer directory options if a ../data/GLSL directory exists. ([40990bb](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/40990bb742cfbbd902a501fa1e39cf9f76e2345d))
* More useful autostart failure message. ([2f4a19c](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/2f4a19c9f68cb35527e840cb30ff6475e76f5877))

### [4.0.4](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.0.3...v4.0.4) (2021-09-18)


### Bug Fixes

* Proper type handling ([f364083](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f364083bf768511837ea60a9b0759465b4be03f3))

### [4.0.3](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.0.2...v4.0.3) (2021-09-18)


### Bug Fixes

* Use mintty for monitor instead of regular terminal, ([d3eed01](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/d3eed012fd5fecab6362369e6ac66f5eca02c612))

### [4.0.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.0.1...v4.0.2) (2021-09-14)


### Bug Fixes

* Make the build process work on Windows again ([c1c65ab](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/c1c65abf6f2ff42e99602bb08f9b69308e81d161))

### [4.0.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v4.0.0...v4.0.1) (2021-09-14)


### Bug Fixes

* Remove references to Clang and some old feature caveats. ([6cbe1ce](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/6cbe1ce6ac59bdf77bbfe8d4fbf288a90cd65ed2))

## [4.0.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.11...v4.0.0) (2021-09-14)


### ⚠ BREAKING CHANGES

* Separate build arguments in launch.json.

### Features

* Include cc65 in build so user doesn't have to install ([375e2e4](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/375e2e44ca01ff5b2c90ba91665b7958474d6be0))
* Separate build arguments in launch.json. ([f98a362](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f98a362a1cfe4dea7154aa624044ad36a9cb9a32))

### [3.7.11](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.10...v3.7.11) (2021-08-29)


### Bug Fixes

* Update marked. Fix Makefile for multiple targets. ([b81e264](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/b81e2644ebbdde149d04c87e195305e6e6550e03))

### [3.7.10](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.9...v3.7.10) (2021-08-29)


### Bug Fixes

* More detailed executable not found message ([4663f9e](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/4663f9e047cb6c0991b4ede9a45ed44f8588ef4c))
* Switch to Jest tests ([8e248b5](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/8e248b5c2e6f3fce82958869818bed0ba5985782))
* Update system ROM folder. ([c417568](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/c4175682c114e0cb892ca62bfd0f5d5e1ee50824))

### [3.7.9](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.8...v3.7.9) (2021-07-15)


### Bug Fixes

* more symlinks ([a92e365](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/a92e365bf7013a36f9e922c02165d02708343a8f))

### [3.7.8](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.7...v3.7.8) (2021-07-15)


### Bug Fixes

* Only test against v3.5 for now. ([032083a](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/032083a10989bc744191109f6b7eb426565415b7))

### [3.7.7](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.6...v3.7.7) (2021-07-07)


### Bug Fixes

* Use hasbin to test existence of vice bins. Javascript tail for Windows. ([bb366fc](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/bb366fc281bd5f3a1a3b3e295dfef805a05b8dbb))
* Work with new version of display get ([fc39254](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/fc39254517d2fcd8c44c8c3804a10fba4934e5df))

### [3.7.6](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.5...v3.7.6) (2021-02-27)


### Bug Fixes

* Added common folder ([99bb144](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/99bb144b4522d1c0cdb12fd720f246f39a11de7b))
* Added note about feature requests. ([7a3302a](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/7a3302a38b60d5eade15d3a7186dcb3187be0251))

### [3.7.5](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.4...v3.7.5) (2021-02-27)


### Bug Fixes

* Step over works as expected in Assembly files. ([b80dcd3](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/b80dcd3fcaded698265f113159c874b54934fcd5))

### [3.7.4](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.3...v3.7.4) (2021-02-27)


### Bug Fixes

* Detect version and use different directory options ([3dbb594](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/3dbb594cb46ac06b5e3b78e6bed33e2df63e711b))
* ignore build.env missing ([6fabbcd](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/6fabbcdee6dc25a071cab6c97bb1b5f0212b6408))
* Properly detect machine type on Windows ([fee5809](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/fee580990c0816fa8de1100f8ce5524d5a014dbb))

### [3.7.3](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.2...v3.7.3) (2021-01-24)


### Bug Fixes

* Don't handle events from other debuggers, ya duh ([2995c32](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/2995c32ba81801c7912f5c490d68ec9678c9e36e))

### [3.7.2](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.1...v3.7.2) (2021-01-24)


### Bug Fixes

* Better handling of non-C64 system files ([0bb3a4b](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/0bb3a4bf15570200bdc8296197d9f82efa406db0))
* Make attach detection more reliable. ([8f4b4eb](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/8f4b4eb0cbfcef759823baa4b95d180b18e63a73))
* Test PET. Properly handle debug and map file launch args ([ae5c645](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/ae5c645b04d583ddd2d41eed25edc14fdb343d42))

### [3.7.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.7.0...v3.7.1) (2021-01-09)


### Bug Fixes

* Handle lower charset correctly ([5b487e9](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5b487e9d26f339ab9fb05201e1f79288155186a6))

## [3.7.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.6.0...v3.7.0) (2021-01-08)


### Features

* Ability to toggle between graphics and lower charsets. ([bfbf15c](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/bfbf15cd372772e07d6c091b6e7d031865359b17))

## [3.6.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.5.1...v3.6.0) (2021-01-05)


### Features

* Added memory tab ([9616938](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/961693865fa7f6a670bc6a281e1ee2415d20ad24))
* Allow color selection for sprites on memory tab. ([fc11cf6](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/fc11cf65d38cfc8a998fe0ddb13469ce82e66760))
* Bank selection for memory viewer ([36a388d](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/36a388d7490d26bf86377e3fa771898d0c5c7afc))
* Screen code text on memory screen ([05e5e77](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/05e5e77b2c525c686763f5778c2ff2f17fbaf048))
* View any part of memory as an array of sprites ([5fd9f17](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/5fd9f17f42983b094a6784e0554d207e81473123))


### Bug Fixes

* Prevent control before the session is fully setup ([8c5c1a0](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/8c5c1a0c8d519410c795073d9afd75a1628824a8))

### [3.5.1](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.5.0...v3.5.1) (2021-01-01)


### Bug Fixes

* Fix syntax file ([2147d46](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/2147d46dddfcd0c35307601b4b19c0bc61e41ed0))

## [3.5.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.4.0...v3.5.0) (2020-12-31)


### Features

* Add screen text viewer ([f5c5b63](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f5c5b63a8c67808db36db359e9460bae7b9e1561))
* Add sprite viewer. ([8bb2797](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/8bb27978c9a74f726c62250483145be2356dddc6))
* Reduce extension size. ([b3c44b1](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/b3c44b1094f5e9b36c07ac6be86e1fdf9a84166f))
* Update project templates to suggest installing the debugger ([c94a81e](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/c94a81ee8edba0769f50c66b33b704a55d5add5b))


### Bug Fixes

* Don't fail if Clang isn't installed ([18e8b1b](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/18e8b1b4bc91c8d05d063cca30e19bbef9e67ce6))
* Don't fail if there are no c files in the project. ([42aedb0](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/42aedb0213ce82ed78ff9befb20a5921ac132d3b))
* Update registers during startup sequence ([a44e74e](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/a44e74e072f771bc1eeb01d36acb1b64295d1256))

## [3.4.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.3.0...v3.4.0) (2020-12-27)


### Features

* Recognize Clang 11/12 if installed ([6f5c71e](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/6f5c71e360a5f66c4f8eb6ab6def73405fc6860c))


### Bug Fixes

* Autostart works correctly again ([ec7a5bc](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/ec7a5bcc7abbece4d668e5a50894f1dc302126ea))
* Terminate actually closes window again ([52567d2](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/52567d25864c63439dbbea276dd1ed6f09e4face))

## [3.3.0](https://www.github.com/empathicqubit/vscode-cc65-debugger/compare/v3.2.0...v3.3.0) (2020-12-24)

### ⚠ BREAKING CHANGES

* Update API calls to work with latest VICE nightly

### Features

* Publish releases automatically ([f6ddead](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f6ddead0b874bf1a951f7dadbefabb8023764fc5))
* Update to VICE 3.5 ([bcc5cac](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/bcc5cace5cee7a56d5966806a8db7681fe6b0e44))
* Better Assembly file handling ([f8c2415](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/f8c2415a4ebb6302b121d0170b06106142d0c337))
* Update API calls to work with latest VICE nightly ([c22d5b2](https://www.github.com/empathicqubit/vscode-cc65-debugger/commit/c22d5b282dc00e1d6837e87189cf825a6cc482e9))

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
