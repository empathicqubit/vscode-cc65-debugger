import Mocha from 'mocha';
import * as path from 'path';
import glob from 'glob';
export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
    });

    mocha.timeout(30000);

    return new Promise((c, e) => {
        glob(__dirname + '/**/*.test.js', (err, files) => {
            if(err) {
                e(err);
                return;
            }

            files.forEach(f => mocha.addFile(f));

            try {
                mocha.run(failures => {
                    if(failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    }
                    else {
                        c();
                    }
                });
            }
            catch(err) {
                e(err);
            }
        });
    });
}