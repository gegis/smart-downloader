"use strict";

const path = require('path');
const fse = require('fs-extra');
const { spawn } = require('child_process');
const commandExistsSync = require('command-exists').sync;
const _ = require('lodash');
const MDFive = require('mdfive').MDFive;
const decompress = require('decompress');
const readline = require('readline');

const md5 = new MDFive();
const wgetErrorCodes = {
    1: 'Wget error',
    2: 'Parse error',
    3: 'File I/O error',
    4: 'Network failure',
    5: 'SSL verification failure',
    6: 'Username/password authentication failure',
    7: 'Protocol error',
    8: 'Server issued an error response'
};

/**
 * Downloader Class
 */
class Downloader {

    /**
     * Constructor
     * @param options object - to override default values
     */
    constructor(options) {

        this.config = _.merge({}, {
            debug: false,
            resumeDownload: true,
            downloadSpeedLimit: null, //value in KiloBytes per second
            downloadSpeedLimitUnit: 'k',
            progressUpdateInterval: 1000 //value in ms
        }, options);
    }

    /**
     * Main download function
     * @param options object - uri, destinationDir, [destinationFileName, md5, extractDir]
     * @param next function - main callback
     * @param progress - callback to receive file download progress
     */
    download(options, next, progress) {

        let command, commandOptions;

        if (commandExistsSync('wget')) {
            try {

                options = _.merge({}, this.config, options);
                commandOptions = this.buildCommandOptions(options);
                fse.ensureDirSync(options.destinationDir);
                command = spawn('wget', commandOptions);
                this.registerListeners(command, options, next, progress);
            } catch(e) {

                next(e, options);
            }
        } else {

            next(new Error('wget command is not supported'), options);
            //TODO implement a fall back download
        }
    }

    /**
     * Builds command line params for wget function
     * @param options
     * @returns {Array}
     */
    buildCommandOptions(options) {

        let cmdOptions = [];

        this.validateOptions(options);

        if (options.destinationFileName) {

            options.destinationFilePath = path.resolve(options.destinationDir, options.destinationFileName);
        } else {

            options.destinationFilePath = path.resolve(options.destinationDir, path.basename(options.uri));
        }

        if (options.resumeDownload) {

            cmdOptions.push('-c');
        }

        if (options.downloadSpeedLimit) {

            cmdOptions.push(`--limit-rate=${options.downloadSpeedLimit}${options.downloadSpeedLimitUnit}`);
        }

        cmdOptions.push('-O', options.destinationFilePath);

        cmdOptions.push(options.uri);

        this.debug('wget', cmdOptions.join(" "));

        return cmdOptions;
    }

    /**
     * Validates required options values
     * @param options
     */
    validateOptions(options) {

        if (!options.uri) {

            throw new Error('Download uri not specified');
        }

        if (!options.destinationDir) {

            throw new Error('Destination dir not specified');
        }
    }

    /**
     * Registers child process stdout/stderr listeners and binds parsed responses to next and progress callbacks
     * @param command function - a spawned child process
     * @param options object - all options
     * @param next function - main callback
     * @param progress function - progress updates callback
     */
    registerListeners(command, options, next, progress) {

        let rlOut, rlErr;
        let commandError = null;
        let progressOptions = {timeout: null};

        if (progress && _.isFunction(progress)) {

            rlOut = readline.createInterface({input:command.stdout});
            rlErr = readline.createInterface({input:command.stderr});

            rlOut.on('line', (line) => {

                this.onDataLine(line, options, progressOptions, progress);
            });

            rlErr.on('line', (line) => {

                this.onDataLine(line, options, progressOptions, progress);
            });
        }

        command.on('error', (err) => {

            commandError = err;
            command.kill("SIGINT");
        });

        command.stdout.on('error', (err) => {

            commandError = err;
            command.kill("SIGINT");
        });

        command.stderr.on('error', (err) => {

            commandError = err;
            command.kill("SIGINT");
        });

        command.on('exit', (code, signal) => {

            clearTimeout(progressOptions.timeout);
            progressOptions.timeout = null;

            if (code === 0 && _.isNull(signal)) {

                this.onSuccessExit(options, next, progress);
            } else {

                this.onErrorExit(commandError, code, signal, options, next);
            }
        });
    }

    /**
     * After child process exit without error code, check md5 if needed and try to extract if needed
     * @param options
     * @param next
     * @param progress
     */
    onSuccessExit(options, next, progress) {

        _.merge(options, {progress: 100});

        if (progress && _.isFunction(progress)) {

            progress(null, options);
        }

        return this.checkMd5Sum(options, this.extract.bind(this, next));
    }


    /**
     * After child process exit with error code, finishes cb flow
     * @param commandError
     * @param code
     * @param signal
     * @param options
     * @param next
     * @returns {*}
     */
    onErrorExit(commandError, code, signal, options, next) {

        let err;
        if (commandError) {

            err = commandError;
        } else {

            err = this.getWgetError(code, signal);
        }

        return next(
            err,
            _.merge({}, options, {
                error: {
                    code,
                    signal
                }
            })
        );
    }

    /**
     * Tries to get pretty error message for exit code
     * @param code
     * @param signal
     * @returns {Error}
     */
    getWgetError(code, signal) {

        let err = 'Download error';

        if (wgetErrorCodes.hasOwnProperty(code)) {

            err = wgetErrorCodes[code];
        } else {

            if (code) {

                err += `. Code: ${code}`;
            }

            if (signal) {

                err += `. Signal: ${signal}`;
            }
        }

        return new Error(err);
    }

    /**
     * On data from child process stdout/stderr, it sends progress updates on every options.progressUpdateInterval
     * @param data buffer
     * @param options object
     * @param progressOptions object
     * @param progress function
     */
    onDataLine(line, options, progressOptions, progress) {

        if (line && !progressOptions.timeout) {

            if (_.indexOf(line, "%") !== -1) {

                progress(null, _.merge({}, options, this.parseProgress(line)));
                progressOptions.timeout = setTimeout(() => {

                    clearTimeout(progressOptions.timeout);
                    progressOptions.timeout = null;
                }, options.progressUpdateInterval);
            }
        }
    }

    /**
     * Parse progress string to get percentage value
     * @param dataString
     * @returns {*|string}
     */
    parseProgress(dataString) {

        let parts;

        dataString = dataString.replace(/ +/g, " ");
        dataString = dataString.replace(/ /g, ":");
        dataString = dataString.replace(/,/g, ".");
        dataString = dataString.replace(/\.+/g, ".");
        dataString = dataString.replace(/\./g, ":");
        dataString = dataString.replace(/:+/g, ":");
        parts = dataString.split(':');

        return {
            downloaded: parts[1],
            progress: parseInt(parts[2]),
            speed: parts[3],
            timeLeft: parts[4]
        };
    }

    /**
     * Checks if options.md5 matches doanloaded file
     * @param options object
     * @param next function
     */
    checkMd5Sum(options, next) {

        if (options.md5) {

            options.md5Matches = false;
            md5.fileChecksum(options.destinationFilePath)
                .then(checksum => {

                    if (checksum === options.md5) {

                        options.md5Matches = true;
                        return next(null, options);

                    } else {

                        options.md5Actual = checksum;
                        return next(new Error('md5sum does not match'), options);
                    }

                })
                .catch(e => {

                    return next(e, options);
                });
        } else {

            next(null, options);
        }

    }

    /**
     * If extract dir is specified, it will attempt to extract downloaded file
     * @param next
     * @param err
     * @param options
     * @returns {*}
     */
    extract(next, err, options) {

        if (err) {

            return next(err, options);
        }

        if (options.extractDir) {

            decompress(options.destinationFilePath, options.extractDir)
                .then(files => {

                    return next(null, options);
                })
                .catch(e => {

                    return next(e, options);
                });
        } else {

            return next(null, options);
        }
    }

    /**
     * Debugs data if enabled
     * @param data
     */
    debug(data) {

        if (this.config.debug) {

            console.log.apply(null, arguments);
        }
    }
}

module.exports = Downloader;