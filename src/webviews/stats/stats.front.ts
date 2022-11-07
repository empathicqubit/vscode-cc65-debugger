import React from 'react';
import * as ReactDOM from 'react-dom';
import { PreferredTextType, RenderProps, renderSprite, ScreenData, SpriteData } from './stats.back';
import * as reactTabs from 'react-tabs';
import { marked } from 'marked';
import classNames from 'classnames';
import { screenMappings } from '../screen-mappings';
import _chunk from 'lodash/fp/chunk';
import _last from 'lodash/fp/last';
import _maxBy from 'lodash/fp/maxBy';
import { Hider } from '../components/hider';

const r = React.createElement;

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

const copyScreenText = (e : ClipboardEvent, textType: PreferredTextType) : void => {
    if(!e.clipboardData) {
        return;
    }
    e.clipboardData.setData('text/plain', convertScreenCodesToUtf8(document.getSelection()!.toString(), textType))
    e.preventDefault();
}

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

export class StatsFront extends React.PureComponent<RenderProps> {
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
            onKeyDown: window.statsWebViewState.keydown,
            onKeyUp: window.statsWebViewState.keyup,
        },
            r(reactTabs.Tabs, {
                className: 'all-tabs',
                onSelect: (index: number, lastIndex: number, evt: MouseEvent) => window.statsWebViewState.updateActiveFrame((evt.target! as HTMLElement).classList.contains("current-frame__tab")),
            },
                r(reactTabs.TabList, null,
                    r(reactTabs.Tab, {
                        className: 'react-tabs__tab current-frame__tab'
                    }, 'Display (Current)'),
                    !this.props.runAhead ? null : r(reactTabs.Tab, null, 'Display (Next)'),
                    r(reactTabs.Tab, null, 'Sprites'),
                    r(reactTabs.Tab, null, 'Text'),
                    r(reactTabs.Tab, null, 'Memory'),
                    r(reactTabs.Tab, null, 'Disassembly'),
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
                                        onChange: (e) => window.statsWebViewState.updatePreferredTextType(e.target.value),
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
                        r("input", { id: 'enable-colors', type: "checkbox", checked: this.props.enableColors, onChange: (e) => window.statsWebViewState.toggleColors(e.target.checked) }),
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
                            onChange: (e) => window.statsWebViewState.changeOffset(e.target.value),
                        }),
                    ),
                    r("label", { htmlFor: 'memview__bank' },
                        "Bank: "
                    ),
                    r('select', {
                        id: 'memview__bank',
                        value: this.props.memBank,
                        onChange: window.statsWebViewState.changeBank,
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
                                                onChange: (e) => window.statsWebViewState.updatePreferredTextType(e.target.value),
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
                                    onChange: e => window.statsWebViewState.updateMemoryIsMultiColor(e.target.checked),
                                }),
                                "Enable multicolor"
                            ),
                            r("label", { htmlFor: 'memview__color1' },
                                "Color 1:"
                            ),
                            r('select', {
                                id: 'memview__color1',
                                value: this.props.memColor1,
                                onChange: (e) => window.statsWebViewState.updateMemColor1(e.target.value)
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
                                onChange: (e) => window.statsWebViewState.updateMemColor3(e.target.value),
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
                                onChange: (e) => window.statsWebViewState.updateMemColor(e.target.value),
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

                r(reactTabs.TabPanel, { className: 'disassembly' },
                    this.props.disassembly[0]?.location?.path
                    ? r('h1', null, this.props.disassembly[0]?.line
                        ? (this.props.disassembly[0]?.location?.path + ':' + (this.props.disassembly[0]?.line + 1))
                        : ''
                    ) : null,
                    r('code', null, r('pre', null,
                        (() => {
                            const disassembly = this.props.disassembly;
                            const firstInstruction = disassembly[0];
                            if(!firstInstruction) {
                                return '';
                            }

                            const longestInstruction = _maxBy(x => x.instruction.length, this.props.disassembly)!;
                            return this.props.disassembly.map(instruction => {
                                let instructionFmt =
                                    instruction.instruction.padEnd(longestInstruction.instruction.length, ' ')
                                        + ' ; $' + parseInt(instruction.address).toString(16).padStart(4, '0');
                                if(typeof instruction.line === 'number' && firstInstruction?.location?.path == instruction.location?.path) {
                                    return '\n; ** line ' + (instruction.line + 1).toString() + ' **\n' + instructionFmt;
                                }
                                else {
                                    return instructionFmt;
                                }
                            }).join('\n');
                        })(),
                    )),
                ),
            )
        );
    }
}