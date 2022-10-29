import classNames from 'classnames';
import _chunk from 'lodash/fp/chunk';
import _sortBy from 'lodash/fp/sortBy';
import { marked } from 'marked';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as reactTabs from 'react-tabs';
import { screenMappings } from './screen-mappings';

interface vscode {
    postMessage(message: {[key: string]: any, request: string}): void;
}

declare const acquireVsCodeApi : () => vscode;

export function _statsWebviewContent() {
    const SPRITE_WIDTH = 24;
    const SPRITE_HEIGHT = 30;
    const spritePixels = Buffer.alloc(4 * SPRITE_WIDTH * SPRITE_HEIGHT);

    const convertScreenCodesToUtf8 = (text: string, textType: PreferredTextType) : string => {
        const stringBuilder = new Array<string>(text.length);
        let i = 0;
        Array.from(text).forEach((chr, d) => {
            const code = chr.charCodeAt(0);
            if(chr == '\n') {
                stringBuilder[i] = '\n';
                i++;
                return;
            }

            const baseChar = code % 0x80;
            //const reverse = code / 0x80 > 1;
            const mapping = screenMappings.find(x => x.screen == baseChar)!;
            if(textType == PreferredTextType.Graphics) {
                stringBuilder[i] = mapping.gfx;
            }
            else if(textType == PreferredTextType.Lower) {
                stringBuilder[i] = mapping.lower || mapping.gfx;
            }

            i++;
        });

        return stringBuilder.join('');
    };

    const renderSprite = (palette: number[], spriteData: SpriteData) : HTMLCanvasElement => {
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

    const renderMemoryBytes = (memoryOffset: number, memory: number[]) : React.ReactElement => {
        const arr = new Array<string>(memory.length + (memory.length / 4) + (memory.length / 16) + 1);
        arr[0] = '';
        let offset = 1;

        for(let i = 0; i < memory.length; i++) {
            if(!(i % 4)) {
                arr[offset] = '';
                offset++;
            }

            if(!(i % 16)) {
                arr[offset] = `\n${(memoryOffset + i).toString(16).padStart(4, '0')}: `;
                offset++;
            }

            arr[offset] = memory[i].toString(16).padStart(2, '0');
            offset++;
        }

        return r('code', null, r('pre', null, arr.join(' ')));
    };

    const renderScreenCodeText = (data: Iterable<number>, width: number, height: number, textType: PreferredTextType, offset: number = 0) => {
        const arr = new Uint8Array((width * height + height) * 2);
        let outputOffset = 0;

        let charsetByte : number
        if(textType == PreferredTextType.Graphics) {
            charsetByte = 0xee;
        }
        else if(textType == PreferredTextType.Lower) {
            charsetByte = 0xef;
        }
        else {
            charsetByte = 0xee;
            console.error('Missing text type');
        }

        for(let i = offset; i < width * height + offset; i++) {
            if(i - offset && !((i - offset) % width)) {
                arr[outputOffset] = '\n'.charCodeAt(0);
                outputOffset++;
                arr[outputOffset] = 0x00;
                outputOffset++;
            }

            arr[outputOffset] = data[i];
            outputOffset++;
            arr[outputOffset] = charsetByte;
            outputOffset++;
        }

        return new TextDecoder('utf-16le').decode(arr);
    }

    const renderScreenText = (palette: number[], screenText: ScreenData, enableColors: boolean, textType: PreferredTextType) : React.ReactElement => {
        if(!screenText) {
            return r('pre');
        }

        const text = renderScreenCodeText(screenText.data, screenText.width, screenText.height, textType);
        if(!enableColors) {
            return r('pre', null, text);
        }

        const styles = palette.map(x => ({
            style: {
                color: '#' + (x >>> 8).toString(16),
            }
        }));

        const elems = new Array<React.ReactElement>(text.length);
        let outputOffset = 0;
        let colorOffset = 0;
        for(let i = 0; i < text.length; i++) {
            const chr = text[i];
            if(chr == '\n') {
                elems[outputOffset] = r('br');
                outputOffset++;
                continue;
            }

            const style = styles[screenText.colors[colorOffset] & 0xf];
            colorOffset++;

            // FIXME Would be faster if you used classes
            elems[outputOffset] = r('span', style, chr);
            outputOffset++;
        }

        return r('pre', null, elems);
    };

    const copyScreenText = (e : ClipboardEvent, textType: PreferredTextType) : void => {
        if(!e.clipboardData) {
            return;
        }
        e.clipboardData.setData('text/plain', convertScreenCodesToUtf8(document.getSelection()!.toString(), textType))
        e.preventDefault();
    }

    const keydown = (evt: React.KeyboardEvent<HTMLDivElement>) : void => {
        if(!data.currentFrameActive) {
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
    };

    const keyup = (evt: React.KeyboardEvent<HTMLDivElement>) : void => {
        if(!data.currentFrameActive) {
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
    };

    const r = React.createElement;

    interface SpriteData extends ImageData {
        key: string;
        blobUrl: string;
        canvas: HTMLCanvasElement;
        isEnabled: boolean;
        isMulticolor: boolean | undefined;
        color: number;
        color1: number;
        color3: number;
    }

    interface ScreenData extends ImageData {
        colors: number[];
    }

    enum PreferredTextType {
        Graphics = 0x01,
        Lower = 0x02,
    }

    interface RenderProps {
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
    };

    class Hider extends React.Component<unknown, { visible: boolean }, unknown> {
        constructor(props) {
            super(props);
            this.state = { visible: false };
        }
        toggleVisible() {
            this.setState({ visible: !this.state.visible })
        }
        render() {
            return r('div', { className: 'hider', onClick: () => this.toggleVisible() },
                r('button', { className: 'hider__info' }, '🛈'),
                this.state.visible
                ? r('div', { className: 'hider__content' },
                    this.props.children
                )
                : null
            );
        }
    }

    class Main extends React.PureComponent<RenderProps> {
        render() {
            let rasterPosition = -1;
            const linMeta = this.props.metas.find(x => x.name == "LIN");
            if(linMeta && this.props.registers.length) {
                const reg = this.props.registers.find(x => x.id == linMeta.id)
                if(reg) {
                    rasterPosition = reg.value / 0xff * 100;
                }
            }

            return r('div', {
                className: 'main',
                tabIndex: -1,
                onKeyDown: keydown,
                onKeyUp: keyup,
            },
                r(reactTabs.Tabs, {
                    className: 'all-tabs',
                    onSelect: (index: number, lastIndex: number, evt: MouseEvent) => {
                        data.currentFrameActive = (evt.target! as HTMLElement).classList.contains("current-frame__tab")
                    },
                },
                    r(reactTabs.TabList, null,
                        r(reactTabs.Tab, {
                            className: 'react-tabs__tab current-frame__tab'
                        }, 'Display (Current)'),
                        !this.props.runAhead ? null : r(reactTabs.Tab, null, 'Display (Next)'),
                        r(reactTabs.Tab, null, 'Sprites'),
                        r(reactTabs.Tab, null, 'Text'),
                        r(reactTabs.Tab, null, 'Memory'),
                    ),
                    r(reactTabs.TabPanel, {
                        className: 'current-frame display-frame',
                    },
                        r(Hider, null,
                            r('div', { dangerouslySetInnerHTML: { __html: marked(`
    This is a duplicate of the screen from the emulator. This is useful if you're
    running headless. The screen and other tabs are updated once per second.
    Pressing keys inside this tab will send them to the emulator. The mapping is
    similar to VICE's default. Tab is C=.
                            `)}}),
                        ),
                        !this.props.current
                            ? r('h1', null, 'Loading...')
                            : r('div', { className: 'display' },
                                r('img', { src: this.props.current.blobUrl }),
                                rasterPosition != -1
                                ? r('hr', {
                                    className: 'display__rasterline',
                                    style: {
                                        top: rasterPosition + '%',
                                    },
                                })
                                : null,
                            )
                    ),
                    !this.props.runAhead
                        ? null
                        : r(reactTabs.TabPanel, {
                            className: 'next-frame display-frame',
                        },
                            r(Hider, null,
                                r('div', { dangerouslySetInnerHTML: { __html: marked(`
    The next frame after the current one. Your changes may not be immediately shown
    on the current screen, due to the way the raster works, so you can try looking
    here instead.
                                `)}}),
                            ),
                            r('img', { src: this.props.runAhead.blobUrl }),
                        ),
                    r(reactTabs.TabPanel, { className: 'sprites' },
                        r(Hider, null,
                            r('div', { dangerouslySetInnerHTML: { __html: marked(`
    The sprites in the current bank, from the lowest visible
    to the highest visible. Dim sprites are ones which are
    not currently displayed. If the sprite isn't visible,
    the 64th byte is used to guess whether it is a
    multicolor (bit 7) and what the sprite color is (bit 0-3).
    The [SpritePad format](https://www.spritemate.com/) uses this convention.
                            `)}}),
                        ),
                        !this.props.sprites || !this.props.sprites.length
                            ? r('h1', null, 'Loading...')
                            : this.props.sprites.map(x =>
                                r('span', {
                                    key: x.key,
                                    className: classNames({
                                        disabled: !x.isEnabled,
                                        sprite: true,
                                    }),
                                    ref: (ref) => ref && ref.lastChild != x.canvas &&
                                        (ref.lastChild ? ref.replaceChild(x.canvas, ref.lastChild) : ref.appendChild(x.canvas))
                                }),
                            ),
                    ),
                    r(reactTabs.TabPanel, { className: 'screentext' },
                        r(Hider, null,
                            r('div', { dangerouslySetInnerHTML: { __html: marked(`
    The text currently displayed on the screen. You can toggle the checkbox to enable
    or disable colors. You can select the text and copy it to your clipboard.
                            `)}}),
                        ),
                        r('div', { className: 'screentext__preferred' },
                            'Preferred character set: ',
                            Object.keys(PreferredTextType)
                                .filter(x => !isNaN(Number(PreferredTextType[x])))
                                .map(textType =>
                                    r('label', { htmlFor: 'screentext__preferred__' + textType },
                                        r('input', {
                                            key: textType,
                                            name: 'screentext__preferred__' + textType,
                                            type: 'radio',
                                            checked: this.props.preferredTextType == PreferredTextType[textType],
                                            onChange: (e) => (data.preferredTextType = parseInt(e.target.value), rerender()),
                                            value: PreferredTextType[textType]
                                        }),
                                        textType
                                    ),
                                )
                        ),
                        !this.props.screenText
                            ? r('h1', null, 'Loading...')
                            : r('code', { onCopy: (e) => copyScreenText(e, this.props.preferredTextType) },
                                renderScreenText(this.props.palette, this.props.screenText, this.props.enableColors, this.props.preferredTextType),
                            ),
                        r("label", { htmlFor: 'enable-colors' },
                            r("input", { id: 'enable-colors', type: "checkbox", checked: this.props.enableColors, onChange: toggleColors }),
                            "Enable colors"
                        ),
                    ),
                    r(reactTabs.TabPanel, { className: 'memview' },
                        r('label', { htmlFor: 'memview__offset' },
                            'Offset: ',
                            r('input', {
                                type: 'text',
                                id: 'memview__offset',
                                value: this.props.memoryOffsetString,
                                onChange: changeOffset,
                            }),
                        ),
                        r("label", { htmlFor: 'memview__bank' },
                            "Bank: "
                        ),
                        r('select', {
                            id: 'memview__bank',
                            value: this.props.memBank,
                            onChange: changeBank,
                            },
                            this.props.banks.map((x, i) => r('option', { key: x.id, value: x.id }, x.name.toString())),
                        ),
                        '$' + this.props.memoryOffset.toString(16).padStart(4, '0'),
                        r(reactTabs.Tabs, null,
                            r(reactTabs.TabList, null,
                                r(reactTabs.Tab, null, 'Raw'),
                                r(reactTabs.Tab, null, 'Sprite'),
                            ),

                            r(reactTabs.TabPanel, { className: 'memview__raw' },
                                r('div', { className: 'memview__preferred' },
                                    'Preferred character set: ',
                                    Object.keys(PreferredTextType)
                                        .filter(x => !isNaN(Number(PreferredTextType[x])))
                                        .map(textType =>
                                            r('label', { htmlFor: 'memview__preferred__' + textType },
                                                r('input', {
                                                    key: textType,
                                                    name: 'memview__preferred__' + textType,
                                                    type: 'radio',
                                                    checked: this.props.preferredTextType == PreferredTextType[textType],
                                                    onChange: (e) => (data.preferredTextType = parseInt(e.target.value), rerender()),
                                                    value: PreferredTextType[textType]
                                                }),
                                                textType
                                            ),
                                        )
                                ),
                                r('div', { className: 'memview__rawcontent' },
                                    renderMemoryBytes(this.props.memoryOffset, this.props.memory),
                                    r('code', { className: 'memview__screentext', onCopy: (e) => copyScreenText(e, this.props.preferredTextType) }, r('pre', null,
                                        renderScreenCodeText(this.props.memory, 16, this.props.memory.length / 16, this.props.preferredTextType, 0)
                                    )),
                                )
                            ),

                            r(reactTabs.TabPanel, null,
                                r("label", { htmlFor: 'memview__multicolor' },
                                    r("input", {
                                        id: 'memview__multicolor',
                                        type: "checkbox",
                                        checked: this.props.memoryIsMulticolor,
                                        onChange: e => (data.memoryIsMulticolor = e.target.checked, rerender())
                                    }),
                                    "Enable multicolor"
                                ),
                                r("label", { htmlFor: 'memview__color1' },
                                    "Color 1:"
                                ),
                                r('select', {
                                    id: 'memview__color1',
                                    value: this.props.memColor1,
                                    onChange: (e) => (data.memColor1 = parseInt(e.target.value), rerender())
                                    },
                                    this.props.palette.map((x, i) => r('option', { key: i, value: i }, i.toString())),
                                ),
                                r('br'),
                                r("label", { htmlFor: 'memview__color3' },
                                    "Color 3:"
                                ),
                                r('select', {
                                    id: 'memview__color3',
                                    value: this.props.memColor3,
                                    onChange: (e) => (data.memColor3 = parseInt(e.target.value), rerender())
                                    },
                                    this.props.palette.map((x, i) => r('option', { key: i, value: i }, i.toString())),
                                ),
                                r('br'),
                                r("label", { htmlFor: 'memview__color' },
                                    "Sprite Color:"
                                ),
                                r('select', {
                                    id: 'memview__color',
                                    value: this.props.memColor,
                                    onChange: (e) => (data.memColor = parseInt(e.target.value), rerender())
                                    },
                                    this.props.palette.map((x, i) => r('option', { key: i, value: i }, i.toString())),
                                ),
                                r('br'),
                                _chunk(0x40, this.props.memory).map((x, i) => {
                                    const sd = <SpriteData>{
                                        data: Uint8ClampedArray.from(x),
                                        width: 24,
                                        height: 21,
                                        key: (i * 0x40 + this.props.memoryOffset).toString(),
                                        blobUrl: '',
                                        canvas: <any>null,
                                        isEnabled: true,
                                        isMulticolor: this.props.memoryIsMulticolor,
                                        color1: this.props.memColor1,
                                        color3: this.props.memColor3,
                                        color: this.props.memColor,
                                    };
                                    const sprite = renderSprite(this.props.palette, sd);
                                    return r('span', {
                                        key: sd.key,
                                        className: 'sprite',
                                        ref: (ref) => ref && ref.lastChild != sprite &&
                                            (ref.lastChild ? ref.replaceChild(sprite, ref.lastChild) : ref.appendChild(sprite))
                                    });
                                }),
                            ),
                        ),
                    ),
                )
            );
        }
    }

    const vscode = acquireVsCodeApi();

    const content = document.querySelector("#content")!;

    const data : RenderProps = {
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
    };

    const rerender = () => ReactDOM.render((r as any)(Main, data), content);

    const toggleColors = (e) => {
        data.enableColors = !!e.target.checked;

        rerender();
    };

    const changeOffset = (e) => {
        const match = /^((\$|0x)([0-9a-f]{0,4})|([0-9]{0,5}))$/i.exec(e.target.value);
        if(!match) {
            return;
        }

        data.memoryOffsetString = e.target.value;

        const isHex = !!match[2];

        if(isHex) {
            data.memoryOffset = parseInt(match[3] || '0', 16);
        }
        else {
            data.memoryOffset = parseInt(match[4] || '0', 10);
        }

        vscode.postMessage({
            request: 'offset',
            offset: data.memoryOffset,
        });

        rerender();
    };

    const changeBank = (e) => {
        data.memBank = parseInt(e.target.value);

        vscode.postMessage({
            request: 'bank',
            bank: data.memBank,
        });

        rerender();
    }

    window.addEventListener('message', async e => {
        try {
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
        }
        catch(e) {
            console.error(e);
        }


        rerender();
    });
}
