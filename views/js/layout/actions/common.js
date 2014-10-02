/**
 * @author Bertrand Chevrier <bertrand@taotesting.com>
 */
define([
    'jquery',
    'i18n',
    'lodash',
    'context',
    'layout/section',
    'layout/actions/binder',
    'layout/search',
    'layout/filter'
], function($, __, _, appContext, section, binder, search, toggleFilter){
    'use strict';

    /**
     * Register common actions.
     *
     * TODO this common actions may be re-structured, split in different files or moved in a more obvious location.
     * 
     * @exports layout/actions/common 
     */
    var commonActions = function(){

        /**
         * Register the load action: load the url and into the content container
         *
         * @this the action (once register it is bound to an action object)
         *
         * @param {Object} actionContext - the current actionContext
         * @param {String} [actionContext.uri]
         * @param {String} [actionContext.classUri]
         */
        binder.register('load', function load(actionContext){
            section.current().loadContentBlock(this.url, _.pick(actionContext, ['uri', 'classUri']));
        });
        
        /**
         * Register the subClass action: creates a sub class
         *
         * @this the action (once register it is bound to an action object)
         *
         * @param {Object} actionContext - the current actionContext
         * @param {String} actionContext.classUri - the URI of the parent class
         * 
         * @fires layout/tree#addnode.taotree
         */
        binder.register('subClass', function subClass(actionContext){
            $.ajax({
                url: this.url,
                type: "POST",
                data: {classUri: actionContext.classUri, type: 'class'},
                dataType: 'json',
                success: function(response){
                    if (response.uri) {
                        $(actionContext.tree).trigger('addnode.taotree', [{
                            'id'        : response.uri, 
                            'parent'    : actionContext.classUri, 
                            'label'     : response.label,
                            'cssClass'  : 'node-class' 
                        }]);
                    }
                }
            });
        });

        /**
         * Register the instanciate action: creates a new instance from a class
         *
         * @this the action (once register it is bound to an action object)
         *
         * @param {Object} actionContext - the current actionContext
         * @param {String} actionContext.classUri - the URI of the class' instance
         * 
         * @fires layout/tree#addnode.taotree
         */
        binder.register('instanciate', function instanciate(actionContext){
            $.ajax({
                url: this.url,
                type: "POST",
                data: {classUri: actionContext.classUri, type: 'instance'},
                dataType: 'json',
                success: function(response){
                    if (response.uri) {
                        $(actionContext.tree).trigger('addnode.taotree', [{
                            'id'        : response.uri, 
                            'parent'    : actionContext.classUri, 
                            'label'     : response.label,
                            'cssClass'  : 'node-instance' 
                        }]);
                    }
                }
            });
        });

        /**
         * Register the duplicateNode action: creates a clone of a node.
         *
         * @this the action (once register it is bound to an action object)
         *
         * @param {Object} actionContext - the current actionContext
         * @param {String} actionContext.uri - the URI of the base instance
         * @param {String} actionContext.classUri - the URI of the class' instance
         * 
         * @fires layout/tree#addnode.taotree
         */
        binder.register('duplicateNode', function duplicateNode(actionContext){
            $.ajax({
                url: this.url,
                type: "POST",
                data: {uri : actionContext.uri, classUri: actionContext.classUri},
                dataType: 'json',
                success: function(response){
                    if (response.uri) {
                        $(actionContext.tree).trigger('addnode.taotree', [{
                            'id'        : response.uri, 
                            'parent'    : actionContext.classUri, 
                            'label'     : response.label,
                            'cssClass'  : 'node-instance' 
                        }]);
                    }
                }
            });
        });

        /**
         * Register the removeNode action: removes a resource.
         *
         * @this the action (once register it is bound to an action object)
         *
         * @param {Object} actionContext - the current actionContext 
         * @param {String} [actionContext.uri]
         * @param {String} [actionContext.classUri]
         * 
         * @fires layout/tree#removenode.taotree
         */
        binder.register('removeNode', function remove(actionContext){
            var data = _.pick(actionContext, ['uri', 'classUri']);
            
            //TODO replace by a nice popup
            if (confirm(__("Please confirm deletion"))) {
                $.ajax({
                    url: this.url,
                    type: "POST",
                    data: data,
                    dataType: 'json',
                    success: function(response){
                        if (response.deleted) {
                            $(actionContext.tree).trigger('removenode.taotree', [{
                                id : actionContext.uri || actionContext.classUri 
                            }]);
                        }
                    }
                });
            }
        });

        /**
         * This action helps to filter tree content.
         * 
         * @this the action (once register it is bound to an action object)
         *
         * @param {Object} actionContext - the current actionContext
         * @param {String} [actionContext.uri]
         * @param {String} [actionContext.classUri]
         *
         * @fires layout/tree#removenode.taotree
         */
        binder.register('filter', function filter(actionContext){
        
            //to be removed
            toggleFilter($('.filter-form'));
        });

        /**
         * Register the removeNode action: removes a resource.
         *
         * @this the action (once register it is bound to an action object)
         *
         * @param {Object} actionContext - the current actionContext
         * @param {String} [actionContext.uri]
         * @param {String} [actionContext.classUri]
         *
         * @fires layout/tree#removenode.taotree
         */
        binder.register('launchFinder', function remove(actionContext){


            var data = _.pick(actionContext, ['uri', 'classUri']),

                // used to avoid same query twice
                uniqueValue = data.uri || data.classUri || '',
                $container  = search.getContainer('search');

            if($container.is(':visible')) {
                search.toggle();
                return;
            }

            if($container.data('current') === uniqueValue) {
                search.toggle();
                return;
            }

            if(this.name.toLowerCase() === 'filter') {
                return;
            }

            $.ajax({
                url: this.url,
                type: "GET",
                data: data,
                dataType: 'html',
                success: function(response){
                    $container.data('current', uniqueValue);
                    search.init(response, uniqueValue);
                }
            });
        });

        
        /**
         * Register the launchEditor action.
         *
         * @this the action (once register it is bound to an action object)
         *
         * @param {Object} actionContext - the current actionContext
         * @param {String} [actionContext.uri]
         * @param {String} [actionContext.classUri]
         *
         * @fires layout/tree#removenode.taotree
         */
        binder.register('launchEditor', function launchEditor(actionContext){

            var data = _.pick(actionContext, ['uri', 'classUri']);
            var wideDifferenciator = '[data-content-target="wide"]';

            $.ajax({
                url: this.url,
                type: "GET",
                data: data,
                dataType: 'html',
                success: function(response){
                    var $response = $(response);
                    //check if the editor should be displayed widely or in the content area
                    if($response.is(wideDifferenciator) || $response.find(wideDifferenciator).length){
                        section.create({
                            id : 'authoring',
                            name : __('Authoring'),
                            url : this.url,
                            content : $response,
                            visible : false
                        })
                        .show(); 
                    } else {
                       section.updateContentBlock($response);
                    }
                }
            });
        });
    };

    return commonActions;
});

