import * as ReactDOM from 'react-dom';
import * as React from 'react';
import * as reactTabs from 'react-tabs';
import _sortBy from 'lodash/fp/sortBy';
import marked from 'marked';

interface vscode {
    postMessage(message: any): void;
}

declare const acquireVsCodeApi : () => vscode;

export function _statsWebviewContent() {
    const r = React.createElement;

    interface spriteData extends ImageData {
        key: string;
        blobUrl: string;
        isEnabled: boolean;
    }

    interface renderProps {
        runAhead: spriteData | null,
        current: spriteData | null,
        sprites: spriteData[],
        screentext: string,
    };

    class Main extends React.PureComponent {
        render() {
            const props = this.props as renderProps;
            return r(reactTabs.Tabs, { className: 'all-tabs'}, 
                r(reactTabs.TabList, null,
                    r(reactTabs.Tab, null, 'Display'),
                    r(reactTabs.Tab, null, 'Sprites'),
                ),
                r(reactTabs.TabPanel, { className: 'display-frames' },
                    !props.runAhead
                    ? r('h1', 'Loading...')
                    : r('div', {className: 'next-frame'},
                        r('h1', null, 'Next Frame'),
                        r('img', { src: props.runAhead.blobUrl }),
                    ),
                    !props.current
                    ? r('h1', 'Loading...')
                    : r('div', {className: 'current-frame'},
                        r('h1', null, 'Current Frame'),
                        r('img', { src: props.current.blobUrl }),
                    ),
                ),
                r(reactTabs.TabPanel, { className: 'sprites' },
                    r('div', { dangerouslySetInnerHTML: { __html: marked(`
The sprites in the current bank, from the lowest visible
to the highest visible. Dim sprites are ones which are
not currently displayed. If the sprite isn't visible,
the 64th byte is used to guess whether it is a
multicolor (bit 7) and what the sprite color is (bit 0-3).
The [SpritePad format](https://www.spritemate.com/) uses this convention.
                    `)}}),
                    !props.sprites || !props.sprites.length
                    ? r('h1', null, 'Loading...')
                    : props.sprites.map(x =>
                        r('img', { className: !x.isEnabled && 'disabled', key: x.key, alt: x.key, src: x.blobUrl })
                    ),
                ),
                r(reactTabs.TabPanel, { className: 'screentext' },
                    !props.screentext
                    ? r('h1', null, 'Loading...')
                    : props.screentext
                ),
            );
        }
    }

    const vscode = acquireVsCodeApi();

    const content = document.querySelector("#content")!;

    document.addEventListener('keydown', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        vscode.postMessage({
            request: 'keydown',
            key: evt.key,
            ctrlKey: evt.ctrlKey,
            shiftKey: evt.shiftKey,
            location: evt.location,
        });

        return false;
    });

    document.addEventListener('keyup', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        vscode.postMessage({
            request: 'keyup',
            key: evt.key,
            ctrlKey: evt.ctrlKey,
            shiftKey: evt.shiftKey,
            location: evt.location,
        });

        return false;
    });

    const data : renderProps = {
        runAhead: null,
        current: null,
        screentext: '',
        sprites: [],
    };

    ReactDOM.render((r as any)(Main, data), content);

    window.addEventListener('message', async e => {
        try {
            const msgData : renderProps = e.data;
            if((msgData as any).reset) {
                data.current = null;
                data.runAhead = null;
                data.sprites = [];
                return;
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
                    const newSprite = () : spriteData => ({
                        ...sprite,
                        blobUrl: URL.createObjectURL(new Blob([new Uint8Array(sprite.data)], {type: 'image/png' })),
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
                            blobUrl: existing.blobUrl,
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


        ReactDOM.render((r as any)(Main, data), content);
    });
}
