"use strict";

const gulp = require('gulp');
const babel = require('gulp-babel');
const jshint = require('gulp-jshint');
const mocha = require('gulp-mocha');
const istanbul = require('gulp-istanbul');
const util = require('gulp-util');

/**
 * Main build task
 */
gulp.task('build', function () {

    gulp.src('./src/**/*.js')
        .pipe(babel({
            presets: ["es2015"]
        }))
        .pipe(gulp.dest('./bin'));
});

/**
 * JS lint task
 */
gulp.task('lint', function() {
    return gulp.src('./src/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

/**
 * Initiates code coverage task
 */
gulp.task('istanbul', function () {

    return gulp.src('./src/**/*.js')
    // Covering files
    .pipe(istanbul())
    // Force `require` to return covered files
    .pipe(istanbul.hookRequire());
});

/**
 * A task to run app tests
 */
gulp.task('tests', ['istanbul'], function() {

    return gulp.src(['./test/init.js', './test/tests/**/*.test.js'])
        .pipe(mocha({
            timeout: 10000
        }))
        .pipe(istanbul.writeReports())
        .pipe(istanbul.enforceThresholds({
            thresholds: {
                global: {
                    statements : 80,
                    branches : 70,
                    functions : 80,
                    lines : 80
                }
            }
        }))
        .once('error', (err) => {

            util.log(err);
            process.exit(1);
        });
});

/**************************************************************************************
                                    Main Gulp Tasks
***************************************************************************************/

/**
 * The default task (called when you run `gulp` from cli)
 * It lints code and builds required libs
 */
gulp.task('default', ['lint', 'tests', 'build'], function (done) {

    console.log('Build successfully finished');
    done();
});


/**
 *
 */
gulp.task('test', ['lint', 'tests'], function (done) {

    console.log('Tests successfully finished');
    done();
});
