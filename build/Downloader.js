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

/**
 * Downloader
 * @private
 */

var Downloader = function () {
    function Downloader(options) {
        _classCallCheck(this, Downloader);

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
        }
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

            cmdOptions.push('-O', options.destinationFilePath);

            cmdOptions.push(options.uri);

            this.debug('wget', cmdOptions.join(" "));

            return cmdOptions;
        }
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
    }, {
        key: 'registerListeners',
        value: function registerListeners(command, options, next, progress) {
            var _this = this;

            var commandError = null;
            var progressOptions = { timeout: null };

            if (progress && _.isFunction(progress)) {

                command.stdout.on('data', function (data) {

                    _this.onData(data, options, progressOptions, progress);
                });

                command.stderr.on('data', function (data) {

                    _this.onData(data, options, progressOptions, progress);
                });
            }

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

                var err = void 0;
                clearTimeout(progressOptions.timeout);
                progressOptions.timeout = null;

                if (code === 0 && _.isNull(signal)) {

                    _.merge(options, { progress: 100 });

                    if (progress && _.isFunction(progress)) {

                        progress(null, options);
                    }

                    if (options.md5) {

                        return _this.checkMd5Sum(options, next);
                    } else {

                        return next(null, options);
                    }
                } else {

                    if (commandError) {

                        err = commandError;
                    } else {

                        err = new Error('Download error: ' + code + ' - ' + signal);
                    }

                    return next(err, _.merge({}, options, {
                        error: {
                            code: code,
                            signal: signal
                        }
                    }));
                }
            });
        }
    }, {
        key: 'onData',
        value: function onData(data, options, progressOptions, progress) {

            var dataString = void 0;
            if (data && !progressOptions.timeout) {

                dataString = data.toString();
                if (data && _.indexOf(dataString, "%") !== -1) {

                    progress(null, _.merge({}, options, { progress: this.parseProgress(dataString) }));
                    progressOptions.timeout = setTimeout(function () {

                        clearTimeout(progressOptions.timeout);
                        progressOptions.timeout = null;
                    }, options.progressUpdateInterval);
                }
            }
        }
    }, {
        key: 'parseProgress',
        value: function parseProgress(dataString) {

            dataString = dataString.replace(/\./g, "");
            dataString = dataString.replace(/ /g, "");
            dataString = dataString.replace(/\n/g, "");
            dataString = dataString.replace(/\t/g, "");
            dataString = dataString.replace(/\r/g, "");

            return dataString.split("%")[0];
        }
    }, {
        key: 'checkMd5Sum',
        value: function checkMd5Sum(options, next) {

            var md5 = new MDFive();

            options.md5Matches = false;
            md5.fileChecksum(options.destinationFilePath).then(function (checksum) {

                if (checksum === options.md5) {

                    options.md5Matches = true;
                    return next(null, options);
                } else {

                    options.md5Actual = checksum;
                    next(new Error('md5sum does not match'), options);
                }
            }).catch(function (err) {

                return next(err, options);
            });
        }
    }, {
        key: 'debug',
        value: function debug(data) {

            if (this.config.debug) {

                console.log.apply(null, arguments);
            }
        }
    }]);

    return Downloader;
}();

module.exports = Downloader;