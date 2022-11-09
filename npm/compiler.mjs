import * as fs from 'fs';
import shx from 'shelljs';

/* Wait for finish if it's already running */

const pidFile = './compiler.run';

let quick = false;
for(const arg of process.argv) {
    if(arg == '--quick') {
        quick = true;
    }
}
if (shx.test('-e', pidFile)) {
    const pid = shx.cat(pidFile);
    console.log('Waiting for active process');
    try {
        process.kill(pid, 0);
    } catch {
        console.log('Removing stale lockfile');
        fs.unlinkSync(pidFile);
    }
    while(true) {
        try {
            process.kill(pid, 0);
        } catch {
            break;
        }
    }
    console.log('Other process finished!');
    process.exit(0);
}
fs.writeFileSync(pidFile, process.pid.toString());
shx.config.fatal = true;
shx.exec('npm-run-all "compiler:choose -- ' + (quick ? '--quick' : '') + '"');
fs.unlinkSync(pidFile);