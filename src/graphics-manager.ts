import * as events from 'events';
import * as bin from './binary-dto';
import * as util from 'util';
import * as fs from 'fs';
import * as debugFile from './debug-file';
import * as path from 'path';
import * as pngjs from 'pngjs';
import _min from 'lodash/fp/min';
import _max from 'lodash/fp/max';
import { ViceGrip } from './vice-grip';

export class GraphicsManager {
    private _currentPng: any;
    private _runAheadPng: any;
    private _spritesPng: any;
    private _ioBank: bin.SingleBankMeta;
    private _vice: ViceGrip;
    private _machineType: debugFile.MachineType = debugFile.MachineType.unknown;
    private _palette: number[] = [];
    private _ramBank: bin.SingleBankMeta;

    constructor(vice: ViceGrip, machineType: debugFile.MachineType) {
        this._spritesPng = new pngjs.PNG({
            width: 24,
            height: 30, 
        });
        this._spritePixels = Buffer.alloc(4 * this._spritesPng.width * this._spritesPng.height);
        this._vice = vice;
        this._machineType = machineType;
    }

    public async postStart(ioBank?: bin.SingleBankMeta, ramBank?: bin.SingleBankMeta) {
        this._ioBank = ioBank!;
        this._ramBank = ramBank!;
        if(this._machineType == debugFile.MachineType.c64) {
            const paletteFileName = await this._vice.execBinary<bin.ResourceGetCommand, bin.ResourceGetResponse>({
                type: bin.CommandType.resourceGet,
                resourceName: 'VICIIPaletteFile',
            });
            const paletteFile = await util.promisify(fs.readFile)(path.normalize(path.join(__dirname, "../system", paletteFileName.stringValue + '.vpl')), 'utf8');
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

            this._palette = palette;
        }
    }

    public async updateScreen(emitter: events.EventEmitter) : Promise<void> {
        await this.updateCurrent(emitter);

        if(this._machineType != debugFile.MachineType.c64) {
            return;
        }

        const ioCmd : bin.MemoryGetCommand = {
            type: bin.CommandType.memoryGet,
            bankId: this._ioBank.id,
            memspace: bin.ViceMemspace.main,
            sidefx: false,
            startAddress: 0xd000,
            endAddress: 0xdfff,
        };
        const ioRes : bin.MemoryGetResponse = await this._vice.execBinary(ioCmd);
        const ioMemory = ioRes.memory;

        await Promise.all([
            this._updateSprites(ioMemory, emitter),
            this._updateText(ioMemory, emitter),
        ]);
    }

    public async updateRunAhead(emitter: events.EventEmitter) : Promise<void> {
        const displayCmd : bin.DisplayGetCommand = {
            type: bin.CommandType.displayGet,
            useVicII: false,
            format: bin.DisplayGetFormat.RGBA,
        };
        const aheadRes : bin.DisplayGetResponse = await this._vice.execBinary(displayCmd);

        if(!this._runAheadPng) {
            this._runAheadPng = new pngjs.PNG({
                width: aheadRes.debugWidth,
                height: aheadRes.debugHeight
            });
        }

        this._runAheadPng.data = aheadRes.rawImageData;

        emitter.emit('runahead', {
            runAhead: {
                data: Array.from(pngjs.PNG.sync.write(this._runAheadPng)),
                width: aheadRes.debugWidth,
                height: aheadRes.debugHeight,
            },
        });
    }

    public async updateCurrent(emitter: events.EventEmitter) : Promise<void> {
        const displayCmd : bin.DisplayGetCommand = {
            type: bin.CommandType.displayGet,
            useVicII: false,
            format: bin.DisplayGetFormat.RGBA,
        };
        const currentRes : bin.DisplayGetResponse = await this._vice.execBinary(displayCmd);

        if(!this._currentPng) {
            this._currentPng = new pngjs.PNG({
                width: currentRes.debugWidth,
                height: currentRes.debugHeight
            });
        }

        this._currentPng.data = currentRes.rawImageData;

        emitter.emit('current', {
            current: {
                data: Array.from(pngjs.PNG.sync.write(this._currentPng)),
                width: currentRes.debugWidth,
                height: currentRes.debugHeight,
            },
        });
    }

    private _spritePixels: Buffer;

    private async _updateText(ioMemory: Buffer, emitter: events.EventEmitter) : Promise<void> {
        const vicSetup = ioMemory.readUInt8(0x018);
        const vicBankMult = ~ioMemory.readUInt8(0xd00) & 0b11;
        const vicBankStart = vicBankMult * 0x4000;
        const screenMult = (vicSetup >>> 4) & 0b1111;
        const screenStart = vicBankStart + screenMult * 0x400;
        const screenMemory = this._vice.getMemory(screenStart, 40 * 25);
        console.log(screenMemory);
    }

    private async _updateSprites(ioMemory: Buffer, emitter: events.EventEmitter) : Promise<void> {
        const SPRITE_COUNT = 8;
        const vicSetup = ioMemory.readUInt8(0x018);
        const vicBankMult = ~ioMemory.readUInt8(0xd00) & 0b11;
        const vicBankStart = vicBankMult * 0x4000;
        const screenMult = (vicSetup >>> 4) & 0b1111;
        const screenStart = vicBankStart + screenMult * 0x400;
        const spriteMultsStart = screenStart + 0x3f8;
        const spriteMults = await this._vice.getMemory(spriteMultsStart, SPRITE_COUNT);
        const spriteMulticolorFlags = ioMemory.readUInt8(0x01c);
        const spriteEnableFlags = ioMemory.readUInt8(0x015);
        const enabledMults = spriteMults.filter((x, i, a) => spriteEnableFlags & (1 << i));
        const color1 = ioMemory.readUInt8(0x025) & 0xf;
        const color3 = ioMemory.readUInt8(0x026) & 0xf;
        const spriteColors = ioMemory.slice(0x027, 0x27 + SPRITE_COUNT);
        const minMult = _min(enabledMults) || 0x00;

        const spriteDataCmd : bin.MemoryGetCommand = {
            type: bin.CommandType.memoryGet,
            startAddress: vicBankStart + 0x40 * minMult,
            endAddress: vicBankStart + 0x40 * ((_max(enabledMults) || 0x00) + 1) - 1,
            memspace: bin.ViceMemspace.main,
            sidefx: false,
            bankId: this._ramBank.id,
        }
        const spriteData : Buffer = (await this._vice.execBinary(spriteDataCmd) as bin.MemoryGetResponse).memory;
        const spriteDatas : Buffer[] = [];
        for(let i = 0; i < spriteData.length; i+=0x40) {
            spriteDatas.push(spriteData.slice(i, i + 0x40));
        }

        const sprites : any[] = [];
        for(let idx = 0; idx < spriteDatas.length; idx++) {
            let slot = spriteMults.indexOf(minMult + idx);
            const mask = slot == -1 
                ? 1 << (idx % SPRITE_COUNT) 
                : 1 << slot;
            const isMulticolor = slot == -1 
                ? spriteDatas[idx].readUInt8(63) & 0x80 
                : !!(spriteMulticolorFlags & mask);
            const isEnabled = slot != -1 && !!(spriteEnableFlags & mask);
            const palette = this._palette;
            const spriteColor = slot == -1 
                ? palette[spriteDatas[idx].readUInt8(63) & 0xf] 
                : palette[spriteColors[slot] & 0xf];
            const spriteImage = this._spritesPng;
            let offset = 0;

            let colors : number[];

            if(isMulticolor) {
                colors = [
                    0x00000000, // transparent
                    palette[color1],
                    spriteColor,
                    palette[color3],
                ];
            }
            else {
                colors = [
                    0x00000000, // transparent
                    spriteColor,
                ];
            }

            if(isMulticolor) {
                for(let b of spriteDatas[idx].slice(0, 63)) {
                    for(let i = 0; i < 4; i++) {
                        const colorIndex = b >>> 6;
                        this._spritePixels.writeUInt32BE(colors[colorIndex], offset);
                        offset+=4;
                        this._spritePixels.writeUInt32BE(colors[colorIndex], offset);
                        offset+=4;
                        b = (b << 2) & 0b11111111;
                    }
                }
            }
            else {
                for(let b of spriteDatas[idx].slice(0, 63)) {
                    for(let i = 0; i < 8; i++) {
                        const colorIndex = b >>> 7;
                        this._spritePixels.writeUInt32BE(colors[colorIndex], offset);
                        offset+=4;
                        b = (b << 1) & 0b11111111;
                    }
                }
            }

            for(let i = 0; i < 9; i++) {
                for(const color of colors) {
                    for(let j = 0; j < spriteImage.width / colors.length; j++) {
                        this._spritePixels.writeUInt32BE(color, offset);
                        offset+=4;
                    }
                }
            }

            spriteImage.data = this._spritePixels;

            const sprite = {
                data: Array.from(pngjs.PNG.sync.write(spriteImage)),
                width: spriteImage.width,
                height: spriteImage.height,
                key: minMult + idx,
                isEnabled,
            };

            sprites.push(sprite);
        }

        emitter.emit('sprites', {
            sprites: sprites,
        });
    }
}