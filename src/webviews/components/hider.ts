import React from "react";

const r = React.createElement;

export class Hider extends React.Component<unknown, { visible: boolean }, unknown> {
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
