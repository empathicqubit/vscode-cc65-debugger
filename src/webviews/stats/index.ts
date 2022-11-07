import { StatsBack } from "./stats.back";

declare global {
    interface Window {
        statsWebViewState: StatsBack,
        statsWebView: Function,
    }
}

window.statsWebView = () => {
    window.statsWebViewState?.dispose();
    window.statsWebViewState = new StatsBack(document.querySelector('#content')!);
    window.statsWebViewState.init();
}