"use strict";

const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const SmartDownloader = require('../../src/Downloader');

const img1 = 'https://github.com/gegis/smart-downloader/raw/master/test/fixtures/code-1.jpg';
const img2 = 'https://github.com/gegis/smart-downloader/raw/master/test/fixtures/code-2.jpg';
const arcTar = 'https://github.com/gegis/smart-downloader/raw/master/test/fixtures/code.tar';
const arcTarGz = 'https://github.com/gegis/smart-downloader/raw/master/test/fixtures/code.tar.gz';
const arcTgz = 'https://github.com/gegis/smart-downloader/raw/master/test/fixtures/code.tgz';
const arcZip = 'https://github.com/gegis/smart-downloader/raw/master/test/fixtures/code.zip';
const downloadDir = './downloads/';

describe('File Download Tests', function() {

    describe(`Call download ${img1} to ${downloadDir}`, function () {
        it(`should download ${img1} to ${downloadDir}`, function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: img1,
                destinationDir: downloadDir
            }, (err, data) => {

                assert.equal(data.destinationDir, downloadDir);
                assert.equal(data.destinationFilePath, path.resolve(downloadDir, path.basename(img1)));
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
            downloader.download({uri: img1}, (err, data) => {

                assert.equal(err.message, 'Destination dir not specified');
                done();
            });
        });
    });

    describe('Call download with md5 checksum to validate downloaded file', function () {
        it('should download and validate file', function (done) {

            const downloader = new SmartDownloader({
                resumeDownload: false
            });
            downloader.download({
                uri: img2,
                destinationDir: downloadDir,
                destinationFileName: 'advanced-2.jpg',
                md5: 'a66ba19137d9ec62a4e68e2ef2ca9e43'
            }, (err, data) => {

                assert.equal(data.md5Matches, true);
                assert.equal(data.md5, 'a66ba19137d9ec62a4e68e2ef2ca9e43');
                assert.notEqual(data.destinationFilePath.indexOf('advanced-2.jpg'), -1);
                assert.equal(data.progress, '100');
                done();
            });
        });
    });

    describe('Call download with wrong md5 checksum to validate downloaded file', function () {
        it('should download and invalidate file', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: img2,
                destinationDir: downloadDir,
                destinationFileName: 'advanced-2.jpg',
                md5: 'a66ba19137d9ec62a4e68e2ef2ca9e43wrong'
            }, (err, data) => {

                assert.equal(err.message, 'md5sum does not match');
                assert.equal(data.md5Matches, false);
                assert.equal(data.md5Actual, 'a66ba19137d9ec62a4e68e2ef2ca9e43');
                assert.equal(data.md5, 'a66ba19137d9ec62a4e68e2ef2ca9e43wrong');
                done();
            });
        });
    });

    describe('Call download with progress callback', function () {
        it('should call back progress cb', function (done) {

            const downloader = new SmartDownloader({
                downloadSpeedLimit: 10,
                progressUpdateInterval: 10
            });

            const fileName = 'advanced-3.jpg';

            const filePath = path.resolve(downloadDir, fileName);

            try {

                fse.statSync(filePath);
                fse.unlinkSync(filePath);
            } catch(e) {

                //File does not exist, do nothing
            }

            downloader.download({
                uri: img1,
                destinationDir: downloadDir,
                destinationFileName: fileName
            }, (err, data) => {

                done();
            }, (err, data) => {

                assert.equal(data.hasOwnProperty('progress'), true);
            });
        });
    });

    describe('Call download non existing file', function () {
        it('should fail to download file', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: 'non-existing-url',
                destinationDir: downloadDir
            }, (err, data) => {

                assert.equal(err.message, 'Network failure');
                done();
            });
        });
    });

    describe('Call download tar file and extract it', function () {
        it('should download and extract tar file', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: arcTar,
                md5: '44e66a2a072961590e54531b41289451',
                destinationDir: downloadDir,
                extractDir: path.resolve(downloadDir, 'tar')
            }, (err, data) => {

                assert.equal(data.extractDir, path.resolve(downloadDir, 'tar'));
                assert.equal(data.md5Matches, true);
                done();
            });
        });
    });

    describe('Call download tarGz file and extract it', function () {
        it('should download and extract tarGz file', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: arcTarGz,
                destinationDir: downloadDir,
                extractDir: path.resolve(downloadDir, 'tarGz')
            }, (err, data) => {

                assert.equal(data.extractDir, path.resolve(downloadDir, 'tarGz'));
                done();
            });
        });
    });

    describe('Call download tgz file and extract it', function () {
        it('should download and extract tgz file', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: arcTgz,
                destinationDir: downloadDir,
                extractDir: path.resolve(downloadDir, 'tgz')
            }, (err, data) => {

                assert.equal(data.extractDir, path.resolve(downloadDir, 'tgz'));
                done();
            });
        });
    });

    describe('Call download zip file and extract it', function () {
        it('should download and extract zip file', function (done) {

            const downloader = new SmartDownloader();
            downloader.download({
                uri: arcZip,
                destinationDir: downloadDir,
                extractDir: path.resolve(downloadDir, 'zip')
            }, (err, data) => {

                assert.equal(data.extractDir, path.resolve(downloadDir, 'zip'));
                done();
            });
        });
    });

});