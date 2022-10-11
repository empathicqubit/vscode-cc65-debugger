import * as events from 'events';
import * as fs from 'fs';
import _max from 'lodash/fp/max';
import _min from 'lodash/fp/min';
import * as path from 'path';
import * as pngjs from 'pngjs';
import * as bin from './binary-dto';
import * as debugFile from '../lib/debug-file';
import { __basedir } from '../basedir';
import { AbstractGrip } from './abstract-grip';

export class GraphicsManager {
    private _currentPng: any;
    private _runAheadPng: any;
    private _metas: bin.SingleRegisterMeta[];
    private _banks: bin.SingleBankMeta[];
    private _ioBank: bin.SingleBankMeta;
    private _emulator: AbstractGrip;
    private _machineType: debugFile.MachineType = debugFile.MachineType.unknown;
    private _ramBank: bin.SingleBankMeta;
    private _memoryOffset: number = 0x0000;
    private _memoryLength: number = 0x1000;
    private _memoryBank: number = 0;
    private _enableStats: boolean = false;

    constructor(emulator: AbstractGrip, machineType: debugFile.MachineType) {
        this._emulator = emulator;
        this._machineType = machineType;
    }

    public async enableStats() : Promise<void> {
        this._enableStats = true;
    }

    public async postEmulatorStart(emitter: events.EventEmitter, ioBank?: bin.SingleBankMeta, ramBank?: bin.SingleBankMeta, banks?: bin.SingleBankMeta[], metas?: bin.SingleRegisterMeta[]) {
        this._ioBank = ioBank!;
        this._ramBank = ramBank!;
        this._banks = banks!;
        this._metas = metas!;
        if(this._machineType == debugFile.MachineType.c64) {
            // FIXME Replace with palette command.
            const paletteFileName = await this._emulator.execBinary({
                type: bin.CommandType.resourceGet,
                resourceName: 'VICIIPaletteFile',
            });
            const paletteFile = await fs.promises.readFile(path.normalize(path.join(__basedir, "../dist/system/C64", paletteFileName.stringValue + '.vpl')), 'utf8');
            const paletteLines = paletteFile.split(/[\r\n]+\s*/gim);
            const paletteActiveLines = paletteLines.filter(x => !/^#/.test(x));
            const paletteLinePattern = /^\s*([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s*$/i;
            const palette : number[] = [];
            for(const line of paletteActiveLines) {
                let match : RegExpMatchArray | null;
                if(!(match = paletteLinePattern.exec(line))) {
                    continue;
                }

                palette.push(parseInt([match[1], match[2], match[3], 'ff'].join(''), 16));
            }

            emitter.emit('palette', {
                palette,
            });
        }
    }

    public async updateMemoryOffset(offset: number) : Promise<void> {
        this._memoryOffset = offset;
    }

    public async updateMemoryBank(bank: number) : Promise<void> {
        this._memoryBank = bank;
    }

    public async updateMemory(emitter: events.EventEmitter) {
        const buf = await this._emulator.getMemory(this._memoryOffset, this._memoryLength, this._memoryBank);
        this._enableStats && emitter.emit('memory', {
            memory: Array.from(buf),
        })
    }

    public async updateBanks(emitter: events.EventEmitter) : Promise<void> {
        this._enableStats && emitter.emit('banks', {
            banks: this._banks
        });
    }

    public async updateRegisters(emitter: events.EventEmitter): Promise<void> {
        const regs = await this._emulator.execBinary(
            {
                type: bin.CommandType.registersGet,
                memspace: bin.EmulatorMemspace.main,
            }
        );

        this._enableStats && emitter.emit('registers', {
            registers: regs.registers,
            metas: this._metas,
        });
    }

    public async updateUI(emitter: events.EventEmitter) : Promise<void> {
        await Promise.all([
            this.updateRegisters(emitter),
            this.updateCurrent(emitter),
            this.updateMemory(emitter),
            this.updateBanks(emitter),
        ]);

        if(this._machineType != debugFile.MachineType.c64) {
            return;
        }

        const ioRes = await this._emulator.execBinary({
            type: bin.CommandType.memoryGet,
            bankId: this._ioBank.id,
            memspace: bin.EmulatorMemspace.main,
            sidefx: false,
            startAddress: 0xd000,
            endAddress: 0xdfff,
        });
        const ioMemory = ioRes.memory;

        await Promise.all([
            this._updateSprites(ioMemory, emitter),
            this._updateText(ioMemory, emitter),
        ]);
    }

    public async updateRunAhead(emitter: events.EventEmitter) : Promise<void> {
        const aheadRes = await this._emulator.displayGetRGBA();

        if(!this._runAheadPng) {
            this._runAheadPng = new pngjs.PNG({
                width: aheadRes.debugWidth,
                height: aheadRes.debugHeight
            });
        }

        this._runAheadPng.data = aheadRes;

        this._enableStats && emitter.emit('runahead', {
            runAhead: {
                data: Array.from(pngjs.PNG.sync.write(this._runAheadPng)),
                width: aheadRes.debugWidth,
                height: aheadRes.debugHeight,
            },
        });
    }

    public async updateCurrent(emitter: events.EventEmitter) : Promise<void> {
        const currentRes = await this._emulator.displayGetRGBA();

        if(!this._currentPng) {
            this._currentPng = new pngjs.PNG({
                width: currentRes.debugWidth,
                height: currentRes.debugHeight
            });
        }

        if(this._machineType == debugFile.MachineType.nes) {
            this._enableStats && emitter.emit('current', {
                current: {
                    data: Array.from(currentRes.rawImageData),
                    width: currentRes.debugWidth,
                    height: currentRes.debugHeight,
                },
            });
        }
        else {
            this._currentPng.data = currentRes.rawImageData;

            this._enableStats && emitter.emit('current', {
                current: {
                    data: Array.from(pngjs.PNG.sync.write(this._currentPng)),
                    width: currentRes.debugWidth,
                    height: currentRes.debugHeight,
                },
            });
        }
    }

    private _spritePixels: Buffer;

    private async _updateText(ioMemory: Buffer, emitter: events.EventEmitter) : Promise<void> {
        const vicSetup = ioMemory.readUInt8(0x018);
        const vicBankMult = ~ioMemory.readUInt8(0xd00) & 0b11;
        const vicBankStart = vicBankMult * 0x4000;
        const screenMult = (vicSetup >>> 4) & 0b1111;
        const screenStart = vicBankStart + screenMult * 0x400;
        const screenMemory = await this._emulator.getMemory(screenStart, 40 * 25);
        const colorRam = ioMemory.slice(0x800, 0xbe8);

        this._enableStats && emitter.emit('screenText', {
            screenText: {
                colors: Array.from(colorRam),
                data: Array.from(screenMemory),
                width: 40,
                height: 25,
            },
        });
    }

    private async _updateSprites(ioMemory: Buffer, emitter: events.EventEmitter) : Promise<void> {
        const VIC_SPRITE_COUNT = 8;
        const vicSetup = ioMemory.readUInt8(0x018);
        const vicBankMult = ~ioMemory.readUInt8(0xd00) & 0b11;
        const vicBankStart = vicBankMult * 0x4000;
        const screenMult = (vicSetup >>> 4) & 0b1111;
        const screenStart = vicBankStart + screenMult * 0x400;
        const spriteMultsStart = screenStart + 0x3f8;
        const spriteMults = await this._emulator.getMemory(spriteMultsStart, VIC_SPRITE_COUNT);
        const spriteMulticolorFlags = ioMemory.readUInt8(0x01c);
        const spriteEnableFlags = ioMemory.readUInt8(0x015);
        const enabledMults = spriteMults.filter((x, i, a) => spriteEnableFlags & (1 << i));
        const color1 = ioMemory.readUInt8(0x025) & 0xf;
        const color3 = ioMemory.readUInt8(0x026) & 0xf;
        const spriteColors = ioMemory.slice(0x027, 0x27 + VIC_SPRITE_COUNT);
        const minMult = _min(enabledMults) || 0x00;
        const spriteCount = ((_max(enabledMults) || 0x00) + 1);

        const spriteDataCmd : bin.MemoryGetCommand = {
            type: bin.CommandType.memoryGet,
            startAddress: vicBankStart + 0x40 * minMult,
            endAddress: vicBankStart + 0x40 * spriteCount - 1,
            memspace: bin.EmulatorMemspace.main,
            sidefx: false,
            bankId: this._ramBank.id,
        }
        const spriteData : Buffer = (await this._emulator.execBinary(spriteDataCmd)).memory;
        const sprites : any[] = [];
        for(let i = 0; i < spriteData.length / 0x40; i++) {
            const spriteBuf = spriteData.slice(i * 0x40, (i + 1) * 0x40);
            let slot = spriteMults.indexOf(minMult + i);
            const mask = slot == -1
                ? 1 << (i % VIC_SPRITE_COUNT)
                : 1 << slot;
            const isEnabled = slot != -1 && !!(spriteEnableFlags & mask);
            const isMulticolor = slot == -1
                ? undefined
                : !!(spriteMulticolorFlags & mask);
            const color = slot == -1
                ? -1
                : spriteColors[slot] & 0xf;
            const sprite = {
                data: Array.from(spriteBuf),
                width: 24,
                height: 21,
                key: minMult + i,
                isEnabled,
                isMulticolor,
                color,
                color1: color1,
                color3: color3,
            };

            sprites.push(sprite);
        }

        this._enableStats && emitter.emit('sprites', {
            sprites: sprites,
        });
    }
}
