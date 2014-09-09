module.exports = function(grunt) {
    'use strict';

    var root = require('path').resolve('../../../');
    var currentExtension = grunt.option('extension') || 'tao';  
    var ext = require('./tasks/helpers/extensions')(grunt, root);
    var sources = {};

    // load all grunt tasks matching the `grunt-*` pattern
    require('load-grunt-tasks')(grunt);

    //extract tao version
    var constants = grunt.file.read('../../includes/constants.php');
    var taoVersion = constants.match(/'TAO_VERSION'\,\s?'(.*)'/)[1];
    grunt.log.write('Found tao version ' + taoVersion);  


    //load the source map generated by the task sourcefinder    
    if(grunt.file.exists('./config/sources.json')){
        sources = require('./config/sources.json');
    } else {
        grunt.log.warn('Please consider generating the source map using `grunt install` ');
        sources = { jshint: [], jsbaselibs : [],  qtiRuntime : [] };
    }

    
    //build some dynamic values for the config regarding the current extensions 
    var amdBundles = [];
    var copies = [];
     ext.getExtensions(true).forEach(function(extension){
        var includes = ext.getExtensionsControllers([extension]);
        if(extension === 'taoQtiItem'){
            includes = includes.concat(sources.qtiruntime).concat(sources.qticreator);
        }
        amdBundles.push({
            name: extension + '/controller/routes',
            include : includes,
            exclude : ['jquery', 'lodash', 'jqueryui', 'main', 'i18n_tr', 'ckeditor', 'mathJax', 'mediaElement', 'css!tao_css/tao-main-style', 'css!taoQtiItem_css/qti'].concat(sources.jsbaselibs)
       });
       copies.push({
           src: ['output/'+ extension +'/controller/routes.js'],  
           dest: ext.getExtensionPath(extension) + '/views/js/controllers.min.js'
       });
    });


    /**
     * 
     * Set up Grunt config
     * 
     */
    grunt.initConfig({
       
        //tao dynamic source finder
        sourcefinder : {
            dist : {
                src : '../../../',
                dest: 'config/sources.json', 
                options: {
                    inConfig : 'sources'
                },
                sources : {
                    'jshint' : {
                        pattern: ['views/js/**/*.js', '!views/js/lib/**/*.js', '!views/js/**/*.min.js'],
                        extension: 'current'
                    },
                    'jsbaselibs' : {
                        pattern : ['views/js/*.js', 'views/js/core/**/*.js', '!views/js/main.js', '!views/js/*.min.js', '!views/js/test/**/*.js'],
                        extension: 'tao',
                        amdify : true
                    },
                    'qtiruntime' : [{
                        pattern : ['views/js/qtiItem/core/**/*.js', 'views/js/qtiCommonRenderer/renderers/**/*.js',  'views/js/qtiCommonRenderer/helpers/**/*.js'],
                        extension: 'taoQtiItem',
                        amdify : true
                    }, {
                        pattern : ['views/js/qtiCommontRenderer/tpl/**/*.tpl'],
                        extension: 'taoQtiItem',
                        replacements : function(file){
                            return  'tpl!' + file.replace(/\.(tpl)$/, '');
                        },
                        amdify : true
                    }],
                    'qticreator' : [{
                        pattern : ['views/js/qtiCreator/editor/**/*.js', 'views/js/qtiCreator/renderers/**/*.js',  'views/js/qtiCreator/helper/**/*.js', 'views/js/qtiCreator/model/**/*.js', 'views/js/qtiCreator/widgets/**/*.js', 'views/js/qtiXmlRenderer/renderers/**/*.js'],
                        extension: 'taoQtiItem',
                        amdify : true
                    }, {
                        pattern : ['views/js/qtiCreator/tpl/**/*.tpl', 'views/js/qtiXmlRenderer/tpl/**/*.tpl'],
                        extension: 'taoQtiItem',
                        replacements : function(file){
                            return  'tpl!' + file.replace(/\.(tpl)$/, '');
                        },
                        amdify : true
                    }]
                }
            }
        },
        
        clean: {
            options:  {
                force : true
            },
            install : ['output' ],
            backendBundle : ['output',  '../js/main.min.js', '../../../*/views/js/controllers.min.js'],
            qtiBundle : ['output', '../../../taoQtiItem/views/js/runtime/qtiLoader.min.js', '../../../taoQtiItem/views/js/runtime/qtiBoostrap.min.js']
        },
        
        copy : {            
            //copy the optimized resources for production 
            backendBundle : {
                files: [
                    { src: ['output/main.js'],  dest: '../js/main.min.js' },
                    { src: ['output/controller/routes.js'],  dest: '../js/controllers.min.js' }
                ].concat(copies)
            },

            preQtiBundle : {
                files: [
                    { src: ['../css/tao-main-style.css'],  dest: 'output/tao_css/tao-main-style.css' },
                    { src: ['../../../taoQtiItems/views/css/qti.css'],  dest: 'output/taoQtiItem_css/qti.css' }
                ]
            }
        },
        
        uglify : {
            //the qti loader is uglify outside the r.js to split the file loading (qtiLoader.min published within the item and qtiBootstrap shared)
            qtiBundle : { 
                files : { 
                    'output/qtiLoader.min.js' : ['../js/lib/require.js', '../../../taoQtiItem/views/js/runtime/qtiLoader.js']
                }
            }
        },
        
        
        replace : {
            
            //we need to change the names of AMD modules to referr to minimified verrsions
            qtiBundle : { 
                 options: {
                     patterns: [{
                        match : 'taoQtiItem/runtime/qtiBootstrap',
                        replacement:  'taoQtiItem/runtime/qtiBootstrap.min',
                        expression: false
                     }],
                     force : true,
                     prefix: ''
                 },
                 files : [ 
                     { src: ['output/taoQtiItem/runtime/qtiBootstrap.js'],  dest: '../../../taoQtiItem/views/js/runtime/qtiBootstrap.min.js' },
                     { src: ['output/qtiLoader.min.js'],  dest: '../../../taoQtiItem/views/js/runtime/qtiLoader.min.js' }
                 ]
             }
        },
        
        /**
         * Optimize JavaScript files
         */
        requirejs: {
            
            //common options
            options : {
                optimize: 'uglify2',
                //optimize : 'none',
                preserveLicenseComments: false,
                optimizeAllPluginResources: false,
                findNestedDependencies : true,
                optimizeCss : 'none',
                buildCss : false,
                inlineText: true,
                paths : ext.getExtensionsPaths(),
           },
            
            /**
             * Compile the javascript files of all TAO backend's extension bundles, 
             * a common bundle (tao's main libs) and extension controlers
             */
            backendBundle : {
                options: {
                    baseUrl : '../js',
                    dir : 'output',
                    mainConfigFile : './config/requirejs.build.js',
                    modules : [{
                        name: 'main',
                        include: [
                            'lib/require'
                        ],
                        deps : sources.jsbaselibs,
                        exclude : ['i18n_tr', 'mathJax', 'mediaElement', 'css!tao_css/tao-main-style', 'css!taoQtiItem_css/qti'],

                    }].concat(amdBundles)
                }
            },
            
            /**
             * Create a specific bundle for the QTI runtime
             */
            qtiBundle : {
                options: {
                    baseUrl : '../js',
                    dir: 'output',
                    mainConfigFile : './config/requirejs.build.js',
                    modules : [{
                        name: 'taoQtiItem/runtime/qtiBootstrap',
                        include: sources.qtiruntime,
                        exclude : ['i18n_tr', 'mathJax', 'mediaElement', 'css!tao_css/tao-main-style', 'css!taoQtiItem_css/qti'],
                    }]
                }
            }
        },

        /**
         * Check your code style by extension
         * grunt jshint --extension=taoItem
         */
        jshint : {
            options : {
                jshintrc : '.jshintrc'
            },
            all : {
                src : sources.jshint
            },
            file : {
                 src : grunt.option('file')
            },
            extension : {
                src : ext.getExtensionSources(currentExtension, ['views/js/**/*.js'])
            }
        },
        
        
        /**
         * Compile SASS to CSS
         * grunt jshint --extension=taoItems
         */
        sass : {
            options : {
                noCache: true,
                loadPath : ['../scss/', '../js/lib/', '../../../taoQtiItem/views/scss/inc', '../../../taoQtiItem/views/scss/qti'],
                lineNumbers : false,
                style : 'compact'
            },
            
            compile : {
                files : {
                    '../css/tao-main-style.css' : '../scss/tao-main-style.scss',
                    '../css/tao-3.css' : '../scss/tao-3.scss',
                    '../css/layout.css' : '../scss/layout.scss',
                    '../js/lib/jsTree/themes/css/style.css' : '../js/lib/jsTree/themes/scss/style.scss',
                    '../../../taoCe/views/css/home.css' : '../../../taoCe/views/scss/home.scss',
                    '../../../taoQtiTest/views/css/creator.css' : '../../../taoQtiTest/views/scss/creator.scss',
                }
            },

            qti : {
                 files : {
                    '../../../taoQtiItem/views/css/item-creator.css' : '../../../taoQtiItem/views/scss/item-creator.scss',
                    '../../../taoQtiItem/views/css/qti.css' : '../../../taoQtiItem/views/scss/qti.scss'
                 },
                 options : {
                    loadPath : ['../scss/', '../js/lib/', '../../../taoQtiItem/views/scss/inc', '../../../taoQtiItem/views/scss/qti']
                }
            },
            delivery : {
                files : {
                    '../../../taoDelivery/views/css/testtakers.css' : '../../../taoDelivery/views/scss/testtakers.scss',
                }
            },
        },
        

        /**
         * Runs a task by watching on file changes (used for development purpose)
         */
        watch : {
            
            /**
             * Watch SASS changes and compile on the fly!
             */
            'sass' : {
                files : ['../scss/*.scss', '../scss/**/*.scss', '../../../*/views/scss/**/*.scss', '../js/lib/**/*.scss'],
                tasks : ['sass:compile', 'notify:sass'],
                options : {
                    debounceDelay : 500
                }
            },
            
            'qtisass' : {
                files : ['../../../taoQtiItem/views/scss/**/*.scss'],
                tasks : ['sass:qti', 'notify:qtisass'],
                options : {
                    debounceDelay : 500
                }
            },

            'deliverysass' : {
                files : ['../../../taoDelivery/views/scss/testtakers.scss'],
                tasks : ['sass:delivery'],
                options : {
                    debounceDelay : 500
                }
            }
	},

	/**
         * Display system notifications
         */
        notify: {
            sass: {
              options: {
                title: 'Grunt SASS', 
                message: 'SASS files compiled to CSS'
              }
            },
            qtisass: {
              options: {
                title: 'Grunt SASS', 
                message: 'QTI SASS files compiled to CSS'
              }
            }
        }
    });

     // Load local tasks.
    grunt.loadTasks('tasks');

    
    /*
     * Create task groups
     */

    grunt.registerTask('install', "Set up app and build", ['clean:install', 'sourcefinder']);
    
    grunt.registerTask('backendBundle', "Create JavaScript bundles for TAO backend",
                        ['clean:backendBundle', 'requirejs:backendBundle', 'copy:backendBundle']);
                        
    grunt.registerTask('qtiBundle', "Create JavaScript bundles for QTI runtimes",
                        ['clean:qtiBundle', 'requirejs:qtiBundle', 'uglify:qtiBundle', 'replace:qtiBundle']);
                        //['clean:qtiBundle', 'copy:preQtiBundle', 'requirejs:qtiBundle', 'uglify:qtiBundle', 'replace:qtiBundle']);
                        
    grunt.registerTask('jsBundle', "Create JavaScript bundles for the whole TAO plateform",
                        ['backendBundle', 'qtiBundle']);

    grunt.registerTask('build', "The full build sequence", ['jsBundle', 'sass:compile', 'sass:qti']);

};
