module.exports = async() => [
    require('./webpack.adapter.config'),
    require('./webpack.extension.config'),
    await require('./webpack.monitor.config')(),
    require('./webpack.webviews.config'),
];