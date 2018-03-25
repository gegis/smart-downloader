"use strict";

const path = require('path');
const fse = require('fs-extra');
const { spawn } = require('child_process');
const commandExistsSync = require('command-exists').sync;
const _ = require('lodash');
const MDFive = require('mdfive').MDFive;

/**
 * Downloader
 * @private
 */
class Downloader {

    constructor(options) {

        this.config = _.merge({}, {
            debug: false,
            resumeDownload: true,
            downloadSpeedLimit: null, //value in KiloBytes per second
            downloadSpeedLimitUnit: 'k',
            progressUpdateInterval: 500 //value in ms
        }, options);
    }

    /**
     *
     * @param options object - uri, destinationDir, [destinationFileName, md5, downloadSpeedLimit, resumeDownload]
     * @param next
     * @param progress
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

    buildCommandOptions(options) {

        let cmdOptions = [];

        if (!options.uri) {

            throw new Error('Download uri not specified');
        }

        if (!options.destinationDir) {

            throw new Error('Destination dir not specified');
        }

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

    registerListeners(command, options, next, progress) {


        let commandError = null;
        let progressOptions = {timeout: null};

        if (progress && _.isFunction(progress)) {

            command.stdout.on('data', (data) => {

                this.onData(data, options, progressOptions, progress);
            });

            command.stderr.on('data', (data) => {

                this.onData(data, options, progressOptions, progress);
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

            let err;
            clearTimeout(progressOptions.timeout);
            progressOptions.timeout = null;

            if (code === 0 && _.isNull(signal)) {

                _.merge(options, {progress: 100});

                if (progress && _.isFunction(progress)) {

                    progress(null, options);
                }

                if (options.md5) {

                    return this.checkMd5Sum(options, next);
                } else {

                    return next(null, options);
                }

            } else {

                if (commandError) {

                    err = commandError;
                } else {

                    err = new Error(`Download error: ${code} - ${signal}`)
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
        });
    }

    onData(data, options, progressOptions, progress) {

        let dataString;
        if (data && !progressOptions.timeout) {

            dataString = data.toString();
            if (data && _.indexOf(dataString, "%") !== -1) {

                progress(null, _.merge({}, options, {progress: this.parseProgress(dataString)}));
                progressOptions.timeout = setTimeout(() => {

                    clearTimeout(progressOptions.timeout);
                    progressOptions.timeout = null;
                }, options.progressUpdateInterval);
            }
        }
    }

    parseProgress(dataString) {

        dataString = dataString.replace(/\./g, "");
        dataString = dataString.replace(/ /g, "");
        dataString = dataString.replace(/\n/g, "");
        dataString = dataString.replace(/\t/g, "");
        dataString = dataString.replace(/\r/g, "");

        return dataString.split("%")[0];
    }

    checkMd5Sum(options, next) {

        const md5 = new MDFive();

        options.md5Matches = false;
        md5.fileChecksum(options.destinationFilePath).then((checksum) => {

            if (checksum === options.md5) {

                options.md5Matches = true;
                return next(null, options);

            } else {

                options.md5Actual = checksum;
                next(new Error('md5sum does not match'), options);
            }

        }).catch((err) => {

            return next(err, options);
        });
    }

    debug(data) {

        if (this.config.debug) {

            console.log.apply(null, arguments);
        }
    }
}

module.exports = Downloader;