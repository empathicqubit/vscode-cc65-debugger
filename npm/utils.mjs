import shx from 'shelljs';

/**
 * @param {string} dirname
 */
export function maybeMkdir(dirname) {
    if(shx.test('-e', dirname)) {
        return;
    }

    shx.mkdir('-p', dirname);
};
