"use strict";

const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const SmartDownloader = require('../../src/Downloader');

describe('File Download Tests', function() {

    describe('Call download from http://www.gstatic.com/webp/gallery/1.jpg into ./downloads/', function () {
        it('should download file 1.jpg into ./downloads/', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: 'http://www.gstatic.com/webp/gallery/1.jpg',
                destinationDir: './downloads/'
            }, (err, data) => {

                assert.equal(data.destinationDir, './downloads/');
                assert.equal(data.destinationFilePath, path.resolve('./downloads/', '1.jpg'));
                done();
            });
        });
    });

    describe('Call download with no options', function () {
        it('should return error with no uri specified', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({}, (err, data) => {

                assert.equal(err.message, 'Download uri not specified');
                done();
            });
        });
    });

    describe('Call download with no destinationDir', function () {
        it('should return error with no destination dir specified', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({uri: 'http://www.gstatic.com/webp/gallery/1.jpg'}, (err, data) => {

                assert.equal(err.message, 'Destination dir not specified');
                done();
            });
        });
    });

    describe('Call download with md5 checksum to validate downloaded file', function () {
        it('should download and validate file', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: 'http://www.gstatic.com/webp/gallery/1.jpg',
                destinationDir: './downloads/',
                destinationFileName: 'advanced-2.jpg',
                md5: 'd4a63031f57bdcafb86ca02100fdd6d2'
            }, (err, data) => {

                assert.equal(data.md5Matches, true);
                assert.equal(data.md5, 'd4a63031f57bdcafb86ca02100fdd6d2');
                assert.equal(data.progress, '100');
                done();
            });
        });
    });

    describe('Call download with wrong md5 checksum to validate downloaded file', function () {
        it('should download and invalidate file', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: 'http://www.gstatic.com/webp/gallery/1.jpg',
                destinationDir: './downloads/',
                destinationFileName: 'advanced-2.jpg',
                md5: 'd4a63031f57bdcafb86ca02100fdd6d2wrong'
            }, (err, data) => {

                console.log(err.message);
                assert.equal(err.message, 'md5sum does not match');
                assert.equal(data.md5Matches, false);
                assert.equal(data.md5Actual, 'd4a63031f57bdcafb86ca02100fdd6d2');
                assert.equal(data.md5, 'd4a63031f57bdcafb86ca02100fdd6d2wrong');
                done();
            });
        });
    });

    describe('Call download with progress callback', function () {
        it('should call back progress cb', function (done) {

            const downloader = new SmartDownloader({
                downloadSpeedLimit: 50,
                progressUpdateInterval: 50
            });

            const filePath = path.resolve('./downloads', 'advanced-2.jpg');

            let doneCalled = false;

            try {

                fse.statSync(filePath);
                fse.unlinkSync(filePath);
            } catch(e) {

                //File does not exist, do nothing
            }

            downloader.download({
                uri: 'http://www.gstatic.com/webp/gallery/1.jpg',
                destinationDir: './downloads/',
                destinationFileName: 'advanced-2.jpg'
            }, (err, data) => {

                //do nothing
            }, (err, data) => {

                if (!doneCalled) {

                    assert.equal(data.hasOwnProperty('progress'), true);
                    doneCalled = true;
                    done();
                }
            });
        });
    });

});