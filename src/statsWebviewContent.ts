export function _statsWebviewContent() {
    window.addEventListener('message', e => {
        console.log(e.data);
    });
}