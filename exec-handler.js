try {
    const proc = require('child_process').spawn(process.argv[2], process.argv.slice(3), {
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