
# Smart Downloader

## Description
HTTP(s) files downloader that can resume your downloads and supports download speed limits (throttle).
It also supports file download progress callback to receive progress value in percentage.

If you already know file md5 checksum, you can also validate downloaded file against it.

*Important - it currently uses `wget` to make file downloads resumable and throttled. So it might not work on all operating systems.
There is a plan to add a fall back to just normal download for unsupported operating systems.

## Install
```npm install --save smart-downloader```

## Simple usage
```
const SmartDownloader = require('smart-downloader');

const downloader = new SmartDownloader();

downloader.download({
    uri: 'http://www.gstatic.com/webp/gallery/1.jpg',
    destinationDir: './downloads/'
}, (err, data) => {

    if (err) {

        console.log(err);
    }

    console.log(data);
});
```

## Advanced usage
A file download with an option to resume and limit download speed to 125 kBps (125 KiloBytes = 1 Megabit) and a custom destination file name:
```
const SmartDownloader = require('smart-downloader');

const downloader = new SmartDownloader();

downloader.download({
    uri: 'http://www.gstatic.com/webp/gallery/1.jpg',
    destinationDir: './downloads/',
    destinationFileName: 'advanced-1.jpg',
    resumeDownload: true,
    downloadSpeedLimit: 125 //value in KiloBytes per second
}, (err, data) => {

    if (err) {

        console.log(err);
    }

    console.log(data);
});
```
You can also specify defaults in constructor and specify md5 checksum value for the downloaded file to be verified
```
const SmartDownloader = require('smart-downloader');

const downloader = new SmartDownloader({
    resumeDownload: true,
    downloadSpeedLimit: 25 //value in KiloBytes per second
});

downloader.download({
    uri: 'http://www.gstatic.com/webp/gallery/1.jpg',
    destinationDir: './downloads/',
    destinationFileName: 'advanced-2.jpg',
    md5: 'd4a63031f57bdcafb86ca02100fdd6d2'
}, (err, data) => {

    if (err) {

        console.log(err);
    }

    console.log(data);
});
```
You can pass progress callback to get download progress updates
```
const SmartDownloader = require('smart-downloader');

const downloader = new SmartDownloader({
    resumeDownload: true,
    downloadSpeedLimit: 250 //value in KiloBytes per second
});

downloader.download({
    uri: 'https://unsplash.com/photos/cvBBO4PzWPg/download?force=true',
    destinationDir: './downloads/',
    destinationFileName: 'advanced-3.jpg',
    md5: 'd94f347a514c051cff5a28814ddacb73'
}, (err, data) => {

    if (err) {

        console.log(err);
    }
    console.log(data);
}, (err, data) => {

    if (err) {

        console.log(err);
    }
    console.log(`Progress: ${data.progress}%`);
});
```