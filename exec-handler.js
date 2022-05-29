try {
    const args = [...process.argv.slice(2)];
    let file = '';
    while((file = args.shift()) == '--ms-enable-electron-run-as-node');

    const proc = require('child_process').spawn(file, args, {
        shell: 'sh',
        stdio: 'inherit',
    });

    proc.on('exit', (code, sig) => {
        process.exit(code);
    });
    proc.on('close', (code, sig) => {
        process.exit(code);
    });
    proc.on('error', (e) => {
        console.error(e);
        process.exit(1);
    });
}
catch (e) {
    console.error(e);
    throw e;
}