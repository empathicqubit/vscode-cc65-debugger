import * as ReactDOM from 'react-dom';
import { StatsFront } from './stats.front';
import _sortBy from 'lodash/fp/sortBy';
import { DebugProtocol } from 'vscode-debugprotocol';
import React from 'react';
import { init } from 'lodash/fp';

const vscode = window.acquireVsCodeApi();

const r = React.createElement;

export interface SpriteData extends ImageData {
    key: string;
    blobUrl: string;
    canvas: HTMLCanvasElement;
    isEnabled: boolean;
    isMulticolor: boolean | undefined;
    color: number;
    color1: number;
    color3: number;
}

export interface ScreenData extends ImageData {
    colors: number[];
}

export interface RenderProps {
    currentFrameActive: boolean;
    runAhead: SpriteData | null;
    current: SpriteData | null;
    sprites: SpriteData[];
    screenText: ScreenData | null;
    preferredTextType: PreferredTextType;
    palette: number[];
    enableColors: boolean;
    memory: number[];
    memoryOffset: number;
    memoryOffsetString: string;
    memoryIsMulticolor: boolean;
    memColor: number;
    memColor1: number;
    memColor3: number;
    memBank: number;
    banks: {id: number, name: string}[];
    metas: {id: number, name: string}[];
    registers: {id: number, value: number}[];
    disassembly: DebugProtocol.DisassembledInstruction[];
};

export enum PreferredTextType {
    Graphics = 0x01,
    Lower = 0x02,
}

// FIXME This function is cross-cutting, probably because it's dealing with non-React HTML elements.
const SPRITE_WIDTH = 24;
const SPRITE_HEIGHT = 30;
const spritePixels = Buffer.alloc(4 * SPRITE_WIDTH * SPRITE_HEIGHT);
export function renderSprite (palette: number[], spriteData: SpriteData) : HTMLCanvasElement {
    const buf = spriteData.data;
    let offset = 0;

    let colors : number[];
    if(typeof spriteData.isMulticolor == 'undefined') {
        spriteData.isMulticolor = !!(spriteData.data[63] & 0x80);
    }

    if(spriteData.color < 0) {
        spriteData.color = spriteData.data[63] & 0xf;
    }

    if(spriteData.isMulticolor) {
        colors = [
            0x00000000, // transparent
            palette[spriteData.color1],
            palette[spriteData.color],
            palette[spriteData.color3],
        ];
    }
    else {
        colors = [
            0x00000000, // transparent
            palette[spriteData.color],
        ];
    }

    if(spriteData.isMulticolor) {
        for(let b of buf.slice(0, 63)) {
            for(let i = 0; i < 4; i++) {
                const colorIndex = b >>> 6;
                spritePixels.writeUInt32BE(colors[colorIndex], offset);
                offset+=4;
                spritePixels.writeUInt32BE(colors[colorIndex], offset);
                offset+=4;
                b = (b << 2) & 0b11111111;
            }
        }
    }
    else {
        for(let b of buf.slice(0, 63)) {
            for(let i = 0; i < 8; i++) {
                const colorIndex = b >>> 7;
                spritePixels.writeUInt32BE(colors[colorIndex], offset);
                offset+=4;
                b = (b << 1) & 0b11111111;
            }
        }
    }

    for(let i = 0; i < 9; i++) {
        for(const color of colors) {
            for(let j = 0; j < SPRITE_WIDTH / colors.length; j++) {
                spritePixels.writeUInt32BE(color, offset);
                offset+=4;
            }
        }
    }

    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_WIDTH;
    canvas.height = SPRITE_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx && ctx.putImageData(new ImageData(Uint8ClampedArray.from(spritePixels), SPRITE_WIDTH, SPRITE_HEIGHT), 0, 0);

    return canvas;
};

export class StatsBack {
    private _data: RenderProps;
    private _content: HTMLDivElement;
    private _listener: (e: any) => void;

    constructor(element: HTMLDivElement) {
        this._content = element;
    }

    private _onMessage(e: MessageEvent<any>) {
        try {
            const data = this._data;
            const msgData : RenderProps = e.data;
            if((msgData as any).reset) {
                data.current = null;
                data.runAhead = null;
                data.sprites = [];
                return;
            }

            if(msgData.banks) {
                if(!data.banks || !data.banks.length) {
                    data.banks = msgData.banks;
                }
            }
            if(msgData.registers) {
                const r = msgData.registers;
                if(!data.registers || data.registers.length != r.length || !data.registers.every((x, i) => r[i].id == x.id && r[i].value == x.value)) {
                    data.registers = r;
                }
            }
            if(msgData.metas) {
                if(!data.metas || !data.metas.length) {
                    data.metas = msgData.metas;
                }
            }
            if(msgData.palette) {
                const p = msgData.palette;
                if(!data.palette || data.palette.length != p.length || !data.palette.every((x, i) => p[i] == x)) {
                    data.palette = p;
                }
            }
            if(msgData.memory) {
                const m = msgData.memory;
                if(!data.memory || data.memory.length != m.length || !data.memory.every((x, i) => m[i] == x)) {
                    data.memory = m;
                }
            }
            if(msgData.screenText) {
                const s = msgData.screenText;
                if(!data.screenText || data.screenText.data.length != s.data.length || !data.screenText.data.every((x, i) => s.data[i] == x)) {
                    data.screenText = s;
                }
            }
            if(msgData.current) {
                const c = msgData.current;
                if(!data.current || data.current.data.length != c.data.length || !data.current.data.every((x, i) => c.data[i] == x)) {
                    data.current = {
                        ...c,
                        blobUrl: URL.createObjectURL(new Blob([new Uint8Array(c.data)], {type: 'image/png' })),
                    }
                }
            }
            if(msgData.runAhead) {
                const r = msgData.runAhead;
                if(!data.runAhead || data.runAhead.data.length != r.data.length || !data.runAhead.data.every((x, i) => r.data[i] == x)) {
                    data.runAhead = {
                        ...r,
                        blobUrl: URL.createObjectURL(new Blob([new Uint8Array(r.data)], {type: 'image/png' })),
                    }
                }
            }
            if(msgData.sprites && msgData.sprites.length) {
                // Add / Modify
                for(const sprite of msgData.sprites) {
                    const newSprite = () : SpriteData => ({
                        ...sprite,
                        canvas: renderSprite(data.palette, sprite),
                    });
                    let existingIndex = -1;
                    const existing = data.sprites.find((x, i) => {
                        existingIndex = i;
                        return x.key == sprite.key;
                    });
                    if(!existing) {
                        data.sprites = _sortBy(x => x.key, [...data.sprites, newSprite()]);
                        continue;
                    }

                    if(existing.data.length != sprite.data.length || !existing.data.every((x, i) => sprite.data[i] == x)) {
                        data.sprites[existingIndex] = newSprite();
                    }
                    else if(existing.isEnabled != sprite.isEnabled) {
                        data.sprites[existingIndex] = {
                            ...sprite,
                            canvas: existing.canvas,
                        }
                    }

                }

                // Remove
                /*
                for(const s in data.sprites) {
                    const sprite = data.sprites[s];
                    const old = msgData.sprites.find(x => x.key == sprite.key);
                    if(!old) {
                        data.sprites.splice(parseInt(s), 1);
                    }
                }
                */
            }
            if(msgData.disassembly) {
                const r = msgData.disassembly;
                if(!data.disassembly || data.disassembly.length != r.length || !data.disassembly.every((x, i) => r[i].address == x.address && r[i].instruction == x.instruction)) {
                    data.disassembly = r;
                }
            }
        }
        catch(e) {
            console.error(e);
        }


        this._rerender();
    }

    private _rerender() {
        ReactDOM.render(r(StatsFront, this._data), this._content);
    }

    init() {
        this._data = {
            currentFrameActive: true,
            runAhead: null,
            current: null,
            screenText: null,
            sprites: [],
            palette: [],
            banks: [],
            metas: [],
            registers: [],
            enableColors: true,
            preferredTextType: PreferredTextType.Graphics,
            memory: [],
            memoryOffset: 0,
            memoryOffsetString: '$0000',
            memoryIsMulticolor: true,
            memBank: 0,
            memColor1: 7,
            memColor3: 14,
            memColor: 8,
            disassembly: [],
        };

        const listener = this._listener = (e) => this._onMessage(e);
        window.addEventListener('message', listener);
        this._rerender();
    }

    dispose() {
        window.removeEventListener('message', this._listener);
    }

    keyup(evt: React.KeyboardEvent<HTMLDivElement>) : void {
        if(!this._data.currentFrameActive) {
            return;
        }

        evt.preventDefault();
        evt.stopPropagation();
        vscode.postMessage({
            request: 'keyup',
            key: evt.key,
            ctrlKey: evt.ctrlKey,
            shiftKey: evt.shiftKey,
            location: evt.location,
        });
    }

    changeOffset(offsetString: string) {
        const match = /^((\$|0x)([0-9a-f]{0,4})|([0-9]{0,5}))$/i.exec(offsetString);
        if(!match) {
            return;
        }

        this._data.memoryOffsetString = offsetString;

        const isHex = !!match[2];

        if(isHex) {
            this._data.memoryOffset = parseInt(match[3] || '0', 16);
        }
        else {
            this._data.memoryOffset = parseInt(match[4] || '0', 10);
        }

        vscode.postMessage({
            request: 'offset',
            offset: this._data.memoryOffset,
        });

        this._rerender();
    };

    updateActiveFrame(isActive: boolean): boolean | void {
        this._data.currentFrameActive = isActive;
    }

    updateMemoryIsMultiColor(checked: boolean): void {
        this._data.memoryIsMulticolor = checked;

        this._rerender();
    }

    updateMemColor1(value: string): any {
        this._data.memColor1 = parseInt(value);

        this._rerender();
    }

    updateMemColor3(value: string): any {
        this._data.memColor3 = parseInt(value);

        this._rerender();
    }

    updateMemColor(value: string): any {
        this._data.memColor = parseInt(value);

        this._rerender();
    }

    updatePreferredTextType(preferredTextType: string): void {
        this._data.preferredTextType = parseInt(preferredTextType);

        this._rerender();
    }

    keydown(evt: React.KeyboardEvent<HTMLDivElement>) : void {
        if(!this._data.currentFrameActive) {
            return;
        }

        evt.preventDefault();
        evt.stopPropagation();
        vscode.postMessage({
            request: 'keydown',
            key: evt.key,
            ctrlKey: evt.ctrlKey,
            shiftKey: evt.shiftKey,
            location: evt.location,
        });
    }

    changeBank(value: string) {
        this._data.memBank = parseInt(value);

        vscode.postMessage({
            request: 'bank',
            bank: this._data.memBank,
        });

        this._rerender();
    }

    toggleColors(checked: boolean) {
        this._data.enableColors = checked;

        this._rerender();
    };
}
