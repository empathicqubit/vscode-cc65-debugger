import * as ReactDOM from 'react-dom';
import * as React from 'react';

export function _statsWebviewContent() {
    const r = React.createElement;
    const content = document.querySelector("#content")!;
    let main = r('div', null, 'Loading...');
    ReactDOM.render(main, content)
    window.addEventListener('message', e => {
        const aheadBlob = new Blob([new Uint8Array(e.data.runAhead)], { type: 'image/bmp'})
        const currentBlob = new Blob([new Uint8Array(e.data.current)], { type: 'image/bmp'})

        main = r('div', null,
            r('div', {className: 'next-frame'},
                r('h1', null, 'Next Frame'),
                r('img', { src: URL.createObjectURL(aheadBlob) }, null),
            ),
            r('div', {className: 'current-frame'},
                r('h1', null, 'Current Frame'),
                r('img', { src: URL.createObjectURL(currentBlob) }, null),
            )
        );

        ReactDOM.render(main, content);
    });
}