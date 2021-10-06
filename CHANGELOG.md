# Changelog

### [4.7.5](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.7.4...v4.7.5) (2021-10-06)


### Bug Fixes

* Timeout the VICE lock so that a stuck command can't break the app. ([0a986fa](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/0a986fabd43a2d5608e906ad9fad7a0d17cf9f5f))

### [4.7.4](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.7.3...v4.7.4) (2021-10-04)


### Bug Fixes

* Include preassigned statics. ([5b98b99](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/5b98b9920c96f450392f897adc80d0772a87cbbb))

### [4.7.3](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.7.2...v4.7.3) (2021-10-04)


### Bug Fixes

* Move action image to the top of the README ([4d5e643](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/4d5e643622fff0756016f643937f2b861a6777ac))

### [4.7.2](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.7.1...v4.7.2) (2021-10-04)


### Bug Fixes

* Update gif to show off expression features. ([fd68d01](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/fd68d016970956c1e5f05a6ec5f3c7435011a70b))

### [4.7.1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.7.0...v4.7.1) (2021-10-04)


### Bug Fixes

* Event handling was breaking sprites. ([2f4cb79](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/2f4cb79f0087ba94886a86398687e4590c2914eb))

## [4.7.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.6.2...v4.7.0) (2021-10-04)


### Features

* Conditional breakpoints work to a small extent. ([28e90ee](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/28e90ee135fb230387a38670f9b3fa15a014dc6d))
* Evaluate log message breakpoints ([c082da6](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/c082da6c798ad71bd0ec8753d393c3a321257370))

### [4.6.2](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.6.1...v4.6.2) (2021-10-04)


### Bug Fixes

* Setting a breakpoint doesn't cause the execution cursor to flash. ([9c1d14e](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/9c1d14edd4c1363edb7f3b0d566e7e9c100aa2ba))

### [4.6.1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.6.0...v4.6.1) (2021-10-03)


### Bug Fixes

* Actually add build entrypoint to zip ([3457391](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/3457391cd40aa1be5a4d178b49e18a1018450ad8))

## [4.6.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.5.1...v4.6.0) (2021-10-03)


### Features

* Added scripts to allow running builds in proper context. ([86b0b0e](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/86b0b0ebe5e366b569e8c310d5287106fa861435))

### [4.5.1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.5.0...v4.5.1) (2021-10-02)


### Bug Fixes

* If we can't find any exit addresses, use the CPU stack. ([5e62f49](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/5e62f4983175fea00fde36262756bc92ccbca7c9))
* Step out at end of function. Fix assembly step out. ([b48c2cc](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/b48c2ccc7235ca8d082ba331392e8ffe68a691fe))

## [4.5.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.4.2...v4.5.0) (2021-09-30)


### Features

* Enhance hover behavior and allow expressions on debugging console ([f075606](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/f075606abdc91acf50291e82e3c4d20e97c4df25))

### [4.4.2](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.4.1...v4.4.2) (2021-09-30)


### Bug Fixes

* Missing address offset for array values. ([573281f](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/573281fda81425615d35c29d02d746ca94341db1))

### [4.4.1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.4.0...v4.4.1) (2021-09-30)


### Bug Fixes

* Use common value rendering code for array values. ([34b6581](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/34b6581e56c6186908053af4d1148f44c55b34e5))

## [4.4.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.3.1...v4.4.0) (2021-09-30)


### Features

* Add variable section for statics. ([f75f4bc](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/f75f4bc42809a4ffef91cb3bd3f77284ed5225fa))

### [4.3.1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.3.0...v4.3.1) (2021-09-29)


### Bug Fixes

* Handle union types correctly ([edbed02](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/edbed020585dddf7c26e7ba4d9a2032eaaf7ce45))

## [4.3.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.2.0...v4.3.0) (2021-09-29)


### Features

* Allow multi-selecting lines ([d181889](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/d1818899c9faf0672c21d456a1703b000624478d))


### Bug Fixes

* Honor cycle configuration at startup ([ddb5606](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/ddb560608175a6ee9a0f2e654624edf3e76f57c4))

## [4.2.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.1.7...v4.2.0) (2021-09-28)


### Features

* Line cycle counter ([0e18d91](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/0e18d9131257e0b7f19053040e14a7f3d0a51335))

### [4.1.7](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.1.6...v4.1.7) (2021-09-27)


### Bug Fixes

* Avoid jumping into macro files if higher level files exist. ([d387134](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/d3871345f62dc7a2a231665dc649d067e9ae247b))
* Kill old CI builds. ([5dd2ecf](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/5dd2ecf9bd7a3eb3e478b7ebfd1c2dee8ce18474))


### Reverts

* Revert "remove weird job cancelly thing" ([71bb6f5](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/71bb6f552843943fedf3271901062d33aa0cb998))

### [4.1.6](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.1.5...v4.1.6) (2021-09-26)


### Bug Fixes

* Use correct symbol name for globals ([f2fa502](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/f2fa502ae435ef81f6b09ee04f0ea7ce65903fef))

### [4.1.5](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.1.4...v4.1.5) (2021-09-26)


### Bug Fixes

* Make globals and locals use the same logic. ([6e20c59](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/6e20c59b9dd5cc16d941653939996a875294c34b))

### [4.1.4](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.1.3...v4.1.4) (2021-09-26)


### Bug Fixes

* Make tests work on the build server again ([8f02b90](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/8f02b909d644b9ab30c81a02998e2565920d014c))

### [4.1.3](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.1.2...v4.1.3) (2021-09-25)


### Bug Fixes

* Include c file first in the stack order. ([221e6d5](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/221e6d501496ea6b97afd3f1ac90211c92a838ef))
* Manual port specification in launch, sequential port assignment. ([749f3d4](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/749f3d4bef603719ebb246889f703fea1b242cad))

### [4.1.2](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.1.1...v4.1.2) (2021-09-23)


### Bug Fixes

* Better(?) icon ([f200c05](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/f200c05067eca0cc9f61e06cfa26b0931f8929d7))

### [4.1.1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.1.0...v4.1.1) (2021-09-23)


### Bug Fixes

* Add a connection timeout. ([5f11e12](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/5f11e1292acd9148046dd3a89f57e3e968798f61))

## [4.1.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.0.4...v4.1.0) (2021-09-23)


### Features

* Add gitignore files for example projects ([99b3506](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/99b3506f7d1e52f410fef2a297a24f9144ed59d8))


### Bug Fixes

* Don't step through serial line accesses to avoid VICE bug ([d00cdb7](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/d00cdb7ef804884dd94ddbe096baa8c7b95ac3cc))
* Infer directory options if a ../data/GLSL directory exists. ([40990bb](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/40990bb742cfbbd902a501fa1e39cf9f76e2345d))
* More useful autostart failure message. ([2f4a19c](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/2f4a19c9f68cb35527e840cb30ff6475e76f5877))

### [4.0.4](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.0.3...v4.0.4) (2021-09-18)


### Bug Fixes

* Proper type handling ([f364083](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/f364083bf768511837ea60a9b0759465b4be03f3))

### [4.0.3](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.0.2...v4.0.3) (2021-09-18)


### Bug Fixes

* Use mintty for monitor instead of regular terminal, ([d3eed01](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/d3eed012fd5fecab6362369e6ac66f5eca02c612))

### [4.0.2](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.0.1...v4.0.2) (2021-09-14)


### Bug Fixes

* Make the build process work on Windows again ([c1c65ab](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/c1c65abf6f2ff42e99602bb08f9b69308e81d161))

### [4.0.1](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v4.0.0...v4.0.1) (2021-09-14)


### Bug Fixes

* Remove references to Clang and some old feature caveats. ([6cbe1ce](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/6cbe1ce6ac59bdf77bbfe8d4fbf288a90cd65ed2))

## [4.0.0](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.11...v4.0.0) (2021-09-14)


### ⚠ BREAKING CHANGES

* Separate build arguments in launch.json.

### Features

* Include cc65 in build so user doesn't have to install ([375e2e4](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/375e2e44ca01ff5b2c90ba91665b7958474d6be0))
* Separate build arguments in launch.json. ([f98a362](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/f98a362a1cfe4dea7154aa624044ad36a9cb9a32))

### [3.7.11](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.10...v3.7.11) (2021-08-29)


### Bug Fixes

* Update marked. Fix Makefile for multiple targets. ([b81e264](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/b81e2644ebbdde149d04c87e195305e6e6550e03))

### [3.7.10](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.9...v3.7.10) (2021-08-29)


### Bug Fixes

* More detailed executable not found message ([4663f9e](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/4663f9e047cb6c0991b4ede9a45ed44f8588ef4c))
* Switch to Jest tests ([8e248b5](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/8e248b5c2e6f3fce82958869818bed0ba5985782))
* Update system ROM folder. ([c417568](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/c4175682c114e0cb892ca62bfd0f5d5e1ee50824))

### [3.7.9](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.8...v3.7.9) (2021-07-15)


### Bug Fixes

* more symlinks ([a92e365](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/a92e365bf7013a36f9e922c02165d02708343a8f))

### [3.7.8](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.7...v3.7.8) (2021-07-15)


### Bug Fixes

* Only test against v3.5 for now. ([032083a](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/032083a10989bc744191109f6b7eb426565415b7))

### [3.7.7](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.6...v3.7.7) (2021-07-07)


### Bug Fixes

* Use hasbin to test existence of vice bins. Javascript tail for Windows. ([bb366fc](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/bb366fc281bd5f3a1a3b3e295dfef805a05b8dbb))
* Work with new version of display get ([fc39254](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/fc39254517d2fcd8c44c8c3804a10fba4934e5df))

### [3.7.6](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.5...v3.7.6) (2021-02-27)


### Bug Fixes

* Added common folder ([99bb144](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/99bb144b4522d1c0cdb12fd720f246f39a11de7b))
* Added note about feature requests. ([7a3302a](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/7a3302a38b60d5eade15d3a7186dcb3187be0251))

### [3.7.5](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.4...v3.7.5) (2021-02-27)


### Bug Fixes

* Step over works as expected in Assembly files. ([b80dcd3](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/b80dcd3fcaded698265f113159c874b54934fcd5))

### [3.7.4](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/compare/v3.7.3...v3.7.4) (2021-02-27)


### Bug Fixes

* Detect version and use different directory options ([3dbb594](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/3dbb594cb46ac06b5e3b78e6bed33e2df63e711b))
* ignore build.env missing ([6fabbcd](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/6fabbcdee6dc25a071cab6c97bb1b5f0212b6408))
* Properly detect machine type on Windows ([fee5809](https://www.github.com/empathicqubit/vscode-cc65-vice-debug/commit/fee580990c0816fa8de1100f8ce5524d5a014dbb))

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
