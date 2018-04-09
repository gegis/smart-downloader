"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var path = require('path');
var fse = require('fs-extra');

var _require = require('child_process'),
    spawn = _require.spawn;

var commandExistsSync = require('command-exists').sync;
var _ = require('lodash');
var MDFive = require('mdfive').MDFive;
var decompress = require('decompress');
var readline = require('readline');

var md5 = new MDFive();
var wgetErrorCodes = {
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

var Downloader = function () {

    /**
     * Constructor
     * @param options object - to override default values
     */
    function Downloader(options) {
        _classCallCheck(this, Downloader);

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


    _createClass(Downloader, [{
        key: 'download',
        value: function download(options, next, progress) {

            var command = void 0,
                commandOptions = void 0;

            if (commandExistsSync('wget')) {
                try {

                    options = _.merge({}, this.config, options);
                    commandOptions = this.buildCommandOptions(options);
                    fse.ensureDirSync(options.destinationDir);
                    command = spawn('wget', commandOptions);
                    this.registerListeners(command, options, next, progress);
                } catch (e) {

                    next(e, options);
                }
            } else {

                next(new Error('wget command is not supported'), options);
                //TODO implement a fall back download
            }

            return command;
        }

        /**
         * Builds command line params for wget function
         * @param options
         * @returns {Array}
         */

    }, {
        key: 'buildCommandOptions',
        value: function buildCommandOptions(options) {

            var cmdOptions = [];

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

                cmdOptions.push('--limit-rate=' + options.downloadSpeedLimit + options.downloadSpeedLimitUnit);
            }

            this.applyHeaders(cmdOptions, options);
            this.applyOtherWgetOptions(cmdOptions, options);

            cmdOptions.push('-O', options.destinationFilePath);

            cmdOptions.push(options.uri);

            this.debug(options, cmdOptions);

            return cmdOptions;
        }
    }, {
        key: 'applyHeaders',
        value: function applyHeaders(cmdOptions, options) {

            if (options && options.headers && _.isArray(options.headers)) {

                options.headers.map(function (header) {

                    if (header) {

                        cmdOptions.push('--header=\'' + header.replace(/'/g, '"') + '\'');
                    }
                });
            }
        }
    }, {
        key: 'applyOtherWgetOptions',
        value: function applyOtherWgetOptions(cmdOptions, options) {

            if (options && options.wgetOptions && _.isArray(options.wgetOptions)) {

                options.wgetOptions.map(function (opt) {

                    cmdOptions.push(opt);
                });
            }
        }

        /**
         * Validates required options values
         * @param options
         */

    }, {
        key: 'validateOptions',
        value: function validateOptions(options) {

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

    }, {
        key: 'registerListeners',
        value: function registerListeners(command, options, next, progress) {
            var _this = this;

            var rlOut = void 0,
                rlErr = void 0;
            var commandError = null;
            var progressOptions = { timeout: null, callbackCalled: false };

            // TODO using readLine method - updates are not that frequent,
            // so progressUpdateInterval does not work as expected
            rlOut = readline.createInterface({ input: command.stdout });
            rlErr = readline.createInterface({ input: command.stderr });

            rlOut.on('line', function (line) {

                _this.onDataLine(line, options, progressOptions, progress);
            });

            rlErr.on('line', function (line) {

                _this.onDataLine(line, options, progressOptions, progress);
            });

            command.on('error', function (err) {

                commandError = err;
                command.kill("SIGINT");
            });

            command.stdout.on('error', function (err) {

                commandError = err;
                command.kill("SIGINT");
            });

            command.stderr.on('error', function (err) {

                commandError = err;
                command.kill("SIGINT");
            });

            command.on('exit', function (code, signal) {

                clearTimeout(progressOptions.timeout);
                progressOptions.timeout = null;

                if (code === 0 && _.isNull(signal)) {

                    _this.onSuccessExit(options, next, progress, progressOptions);
                } else {

                    _this.onErrorExit(commandError, code, signal, options, next);
                }
            });
        }

        /**
         * After child process exit without error code, check md5 if needed and try to extract if needed
         * @param options
         * @param next
         * @param progress
         */

    }, {
        key: 'onSuccessExit',
        value: function onSuccessExit(options, next, progress, progressOptions) {

            _.merge(options, { progress: 100 });

            if (progress && _.isFunction(progress) && !progressOptions.callbackCalled) {

                progress(null, options, { downloaded: null, speed: null, timeLeft: null });
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

    }, {
        key: 'onErrorExit',
        value: function onErrorExit(commandError, code, signal, options, next) {

            var err = void 0;
            if (commandError) {

                err = commandError;
            } else {

                err = this.getWgetError(code, signal);
            }

            return next(err, _.merge({}, options, {
                error: {
                    code: code,
                    signal: signal
                }
            }));
        }

        /**
         * Tries to get pretty error message for exit code
         * @param code
         * @param signal
         * @returns {Error}
         */

    }, {
        key: 'getWgetError',
        value: function getWgetError(code, signal) {

            var err = 'Download error';

            if (wgetErrorCodes.hasOwnProperty(code)) {

                err = wgetErrorCodes[code];
            } else {

                if (code) {

                    err += '. Code: ' + code;
                }

                if (signal) {

                    err += '. Signal: ' + signal;
                }
            }

            return new Error(err);
        }

        /**
         * On data from child process stdout/stderr, it sends progress updates on every options.progressUpdateInterval
         * @param line string
         * @param options object
         * @param progressOptions object
         * @param progress function
         */

    }, {
        key: 'onDataLine',
        value: function onDataLine(line, options, progressOptions, progress) {

            var progressData = void 0;

            if (line && !progressOptions.timeout) {

                if (_.indexOf(line, "%") !== -1) {

                    progressData = this.parseProgress(line);
                    options.progress = progressData.progress;
                    this.notifyProgress(options, progressOptions, progress, progressData);
                    progressOptions.timeout = setTimeout(function () {

                        clearTimeout(progressOptions.timeout);
                        progressOptions.timeout = null;
                    }, options.progressUpdateInterval);
                }
            }
        }

        /**
         * Calls progress callback with progress information, if there is one set
         * @param options
         * @param progressOptions
         * @param progress
         * @param progressData
         */

    }, {
        key: 'notifyProgress',
        value: function notifyProgress(options, progressOptions, progress, progressData) {

            if (progress && _.isFunction(progress)) {

                progressOptions.callbackCalled = true;
                progress(null, _.merge({}, options, progressData));
            }
        }

        /**
         * Parse progress string to get percentage value
         * @param dataString
         * @returns object
         */

    }, {
        key: 'parseProgress',
        value: function parseProgress(dataString) {

            var parts = void 0;
            var data = {
                downloaded: null,
                progress: null,
                speed: null,
                timeLeft: null
            };

            dataString = dataString.replace(/ +/g, " ");
            dataString = dataString.replace(/ /g, ":");
            dataString = dataString.replace(/,/g, ".");
            dataString = dataString.replace(/\.+/g, ".");
            dataString = dataString.replace(/\./g, ":");
            dataString = dataString.replace(/:+/g, ":");
            dataString = dataString.replace(/=/g, ":");
            parts = dataString.split(':');

            if (_.size(parts) === 7) {

                data = {
                    downloaded: parts[1],
                    progress: parseInt(parts[2]),
                    speed: parts[3] + '.' + parts[4],
                    timeLeft: parts[5] + '.' + parts[6]
                };
            } else if (_.size(parts) === 6) {

                data = {
                    downloaded: parts[1],
                    progress: parseInt(parts[2]),
                    speed: parts[3] + '.' + parts[4],
                    timeLeft: parts[5]
                };
            } else {

                data = {
                    downloaded: parts[1],
                    progress: parseInt(parts[2]),
                    speed: parts[3],
                    timeLeft: parts[4]
                };
            }

            return data;
        }

        /**
         * Checks if options.md5 matches doanloaded file
         * @param options object
         * @param next function
         */

    }, {
        key: 'checkMd5Sum',
        value: function checkMd5Sum(options, next) {

            if (options.md5) {

                options.md5Matches = false;
                md5.fileChecksum(options.destinationFilePath).then(function (checksum) {

                    if (checksum === options.md5) {

                        options.md5Matches = true;
                        return next(null, options);
                    } else {

                        options.md5Actual = checksum;
                        return next(new Error('md5sum does not match'), options);
                    }
                }).catch(function (e) {

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

    }, {
        key: 'extract',
        value: function extract(next, err, options) {

            if (err) {

                return next(err, options);
            }

            if (options.extractDir) {

                decompress(options.destinationFilePath, options.extractDir).then(function (files) {

                    return next(null, options);
                }).catch(function (e) {

                    return next(e, options);
                });
            } else {

                return next(null, options);
            }
        }

        /**
         * Debugs data if enabled
         * @param options
         * @param cmdOptions
         */

    }, {
        key: 'debug',
        value: function debug(options, cmdOptions) {

            if (this.config.debug) {

                console.log('wget', cmdOptions.join(" "));
                options.debugInfo = {
                    command: 'wget ' + cmdOptions.join(" ")
                };
            }
        }
    }]);

    return Downloader;
}();

module.exports = Downloader;