"use strict";

const gulp = require('gulp');
const babel = require('gulp-babel');
const jshint = require('gulp-jshint');

/**
 * Ensures local.js config file exists
 */
gulp.task('build', function () {

    gulp.src('./src/**/*.js')
        .pipe(babel({
            presets: ["es2015"]
        }))
        .pipe(gulp.dest('./bin'));
});

gulp.task('lint', function() {
    return gulp.src('./src/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

/**************************************************************************************
                                    Main Gulp Tasks
***************************************************************************************/

/**
 * The default task (called when you run `gulp` from cli)
 * It builds all client files and starts the node app
 * If --env prod value is passed it will build production ready files and run the server
 */
gulp.task('default', ['lint', 'build'], function (done) {

    console.log('Build successfully finished')
    done();
});
