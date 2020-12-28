import * as ReactDOM from 'react-dom';
import * as React from 'react';
import _sortBy from 'lodash/fp/sortBy';

interface vscode {
    postMessage(message: any): void;
}

declare const acquireVsCodeApi : () => vscode;

export function _statsWebviewContent() {
    const r = React.createElement;

    interface spriteData extends ImageData {
        key: string;
        blobUrl: string;
    }

    interface renderProps {
        runAhead: spriteData | null,
        current: spriteData | null,
        sprites: spriteData[],
    };

    class Main extends React.PureComponent {
        render() {
            const props = this.props as renderProps;
            return r('div', null,
                [
                    r('div', { className: 'display-frames' },
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
                    r('div', { className: 'sprites' }, 
                        r('h1', null, 'Sprites'),
                        props.sprites.map(x => 
                            r('img', { key: x.key, alt: x.key,  src: x.blobUrl })
                        )
                    )
                ]
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
        sprites: [],
    };

    ReactDOM.render((r as any)(Main, data), content);

    window.addEventListener('message', async e => {
        try {
            const msgData : renderProps = e.data;
            if(msgData.current) {
                const c = msgData.current;
                if(!data.current || !data.current.data.every((x, i) => c.data[i] == x)) {
                    data.current = {
                        ...c,
                        blobUrl: URL.createObjectURL(new Blob([new Uint8Array(c.data)], {type: 'image/png' })),
                    }
                }
            }
            if(msgData.runAhead) {
                const r = msgData.runAhead;
                if(!data.runAhead || !data.runAhead.data.every((x, i) => r.data[i] == x)) {
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

                    if(!existing.data.every((x, i) => sprite.data[i] == x)) {
                        data.sprites[existingIndex] = newSprite();
                    }
                }

                // Remove
                for(const s in data.sprites) {
                    const sprite = data.sprites[s];
                    const old = msgData.sprites.find(x => x.key == sprite.key);
                    if(!old) {
                        data.sprites.splice(parseInt(s), 1);
                    }
                }
            }
        }
        catch(e) {
            console.error(e);
        }


        ReactDOM.render((r as any)(Main, data), content);
    });
}