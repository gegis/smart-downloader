"use strict";

const fse = require('fs-extra');

before(function(done) {

    fse.removeSync('./downloads');
    done();
});

after(function(done) {

    done();
});