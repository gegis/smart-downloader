"use strict";

/**
 * Ensures local.js config file exists
 */
gulp.task('build', function (done) {

    done();
});



/**************************************************************************************
                                    Main Gulp Tasks
***************************************************************************************/

/**
 * The default task (called when you run `gulp` from cli)
 * It builds all client files and starts the node app
 * If --env prod value is passed it will build production ready files and run the server
 */
gulp.task('default', ['build']);
