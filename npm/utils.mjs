import shx from './shelljs.js';

/**
 * @param {string} dirname
 */
export function maybeMkdir(dirname) {
    if(shx.test('-e', dirname)) {
        return;
    }

    try {
        shx.mkdir('-p', dirname);
    }
    catch {}
};
