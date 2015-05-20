/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2014 (original work) Open Assessment Technologies SA (under the project TAO-PRODUCT);
 */
/**
 * Wraps a jQuery autocomplete plugin inside a component.
 * Source code of the wrapped plugin: https://github.com/devbridge/jQuery-Autocomplete
 * @author Jean-Sébastien Conan <jean-sebastien.conan@vesperiagroup.com>
 */
define([
    'jquery',
    'lodash',
    'i18n',
    'jquery.autocomplete'
], function($, _, __) {

    'use strict';

    /**
     * Namespace for component
     * @type {String}
     */
    var NS = 'autocompleter';

    /**
     * A list of default values for allowed options
     * @type {Object}
     */
    var Defaults = {
        /**
         * The name of the wrapped plugin
         * @type {String}
         */
        pluginName : 'autocomplete',

        /**
         * Defines the URL to data source
         * @type {String}
         */
        url : null,

        /**
         * Defines a list of extra params to be sent with the query.
         * @type {Object}
         */
        params : null,

        /**
         * Defines the root for seach params.
         * When provided, all the search params are wrapped under the same root.
         * @type {String}
         */
        paramsRoot : null,

        /**
         * Defines the name of the param providing the ontology URI
         * @type {String}
         */
        ontologyParam : 'rootNode',

        /**
         * Defines the name of the param providing the searched pattern
         * @type {String}
         */
        queryParam : 'query',

        /**
         * Defines the request method. Can be either GET or POST, default to GET.
         * @type {String}
         */
        type : 'GET',

        /**
         * Defines the URI of the target ontology.
         * @type {String}
         */
        ontology : null,

        /**
         * The current value
         * @type {String}
         */
        value : null,

        /**
         * The current label
         * @type {String}
         */
        label : null,

        /**
         * Defines the name of the field containing the value within the received data.
         * @type {String}
         */
        valueField : 'id',

        /**
         * Defines the name of the field containing the label within the received data.
         * @type {String}
         */
        labelField : 'http://www.w3.org/2000/01/rdf-schema#label',

        /**
         * When set to true the component acts as a data provider.
         * In this mode, each time an item is selected from a list,
         * it will be directly removed from the input, so the listener
         * has to take care of the selected value and to add it in its own list.
         * @type {Boolean}
         */
        isProvider : false,

        /**
         * Number of miliseconds to defer ajax request.
         * @type {Number}
         */
        delay : 250,

        /**
         * Minimum number of characters required to trigger the ajax request.
         * @type {Number}
         */
        minChars : 3
    };

    var Autocompleter = {

        /**
         * @event beforeSelectItem Fired when the user select a suggestion in the list.
         * @param {Event} event
         * @param {String} value
         * @param {String} label
         * @param {Autocompleter} instance
         * @returns {Boolean} The handler can returns `false` to prevent default handling
         */

        /**
         * @event selectItem Fired after the user has selected a suggestion in the list.
         * @param {Event} event
         * @param {String} value
         * @param {String} label
         * @param {Autocompleter} instance
         */

        /**
         * @event searchStart Fired when the user input text and a query is about to be requested.
         * @param {Event} event
         * @param {Object} params The list of params which will be bound the query
         * @param {Autocompleter} instance
         * @returns {Boolean} The handler can returns `false` to prevent default handling
         */

        /**
         * @event searchComplete Fired after ajax response is processed.
         * @param {Event} event
         * @param {String} query The requested fragment
         * @param {Object} suggestions An array containing the results.
         * @param {Autocompleter} instance
         */

        /**
         * @event searchError Fired if ajax request fails.
         * @param {Event} event
         * @param {String} query
         * @param {jqXHR} jqXHR
         * @param {String} textStatus
         * @param {Exception} errorThrown
         * @param {Autocompleter} instance
         */

        /**
         * @event invalidateSelection Fired when input is altered after selection has been made.
         * @param {Event} event
         * @param {Autocompleter} instance
         */

        /**
         * @event beforeRender Fired before displaying the suggestions.
         * You may manipulate suggestions DOM before it is displayed.
         * @param {Event} event
         * @param {jQuery} $container
         * @param {Autocompleter} instance
         */

        /**
         * Initializes the component. Installs the autocompleter onto an element.
         * @param {jQuery|Element|String} element The element on which install the autocompleter
         * @param {Object} options A list of options to set
         * The complete list of plugin options can be found at: https://github.com/devbridge/jQuery-Autocomplete
         * @returns {Autocompleter} this
         */
        init : function(element, options) {
            this.$element = $(element);
            if (!this.$element.is(':input')) {
                this.$element = this.$element.find(':input');
            }

            this.$element[this.pluginName](this.parseOptions(options));
            return this;
        },

        /**
         * Destroys the wrapped plugin instance.
         * All events are detached and suggestion containers removed.
         * The value is conserved.
         * @returns {Autocompleter} this
         */
        destroy : function() {
            this.applyPlugin('dispose');
            this.$element && this.$element.off('.' + NS);
            this.$element = null;
            return this;
        },

        /**
         * Parses the provided options and filters them.
         * Separates the component options from those which go the plugin instance.
         * Immediately applies the component options, returns the plugin options.
         * @param {Object} options A list of options to filter.
         * The complete list of plugin options can be found at: https://github.com/devbridge/jQuery-Autocomplete
         * @returns {Object} Returns the list of plugin options and their values.
         */
        parseOptions : function(options) {
            var that = this;
            var pluginOptions = {};

            // filter the options
            _.forOwn(options, function(value, name) {
                var setterName = 'set' + capitalize(name);
                if (that[setterName]) {
                    // a setter exists for this option
                    that[setterName](value);
                } else if (name.substr(0, 2) === 'on') {
                    // this option is an event handler
                    that.on(name.substr(2), value);
                } else {
                    // not a component option, forward it to the plugin instance
                    options[name] = value;
                }
            });

            // adjust options to be forwarded to the plugin instance
            pluginOptions.onSelect = this._onSelect.bind(this);
            pluginOptions.onSearchStart = this._onSearchStart.bind(this);
            pluginOptions.onSearchComplete = this._onSearchComplete.bind(this);
            pluginOptions.onSearchError = this._onSearchError.bind(this);
            pluginOptions.onInvalidateSelection = this._onInvalidateSelection.bind(this);
            pluginOptions.beforeRender = this._onBeforeRender.bind(this);
            pluginOptions.transformResult = this._transformResult.bind(this);
            pluginOptions.deferRequestBy = this.delay || 0;
            pluginOptions.preventBadQueries = false;
            pluginOptions.triggerSelectOnValidInput = false;
            pluginOptions.autoSelectFirst = true;
            pluginOptions.minChars = this.minChars || 1;
            pluginOptions.serviceUrl = this.url;
            pluginOptions.type = this.getType();
            pluginOptions.params = this.getParams();
            pluginOptions.paramName = this.getQueryParam();
            pluginOptions.ajaxSettings = {
                dataType : 'json'
            };

            return pluginOptions;
        },

        /**
         * Applies options onto the component and the wrapped plugin instance.
         * @param {Object} options A list of named options to set.
         * The complete list of plugin options can be found at: https://github.com/devbridge/jQuery-Autocomplete
         * @returns {Autocompleter} this
         */
        setOptions : function(options) {
            this.applyPlugin('setOptions', [this.parseOptions(options)]);
            return this;
        },

        /**
         * Calls a method on the inner element with the provided list of params.
         * @param {String} action The name of the method to call
         * @param {Array} [params] A list of optional params to pass to the called method
         * @returns {*} Returns the callee result
         */
        applyElement : function(action, params) {
            var $element = this.$element;

            if ($element) {
                return $element[action].apply($element, params);
            }
        },

        /**
         * Calls a method on the wrapped plugin with the provided list of params.
         * @param {String} action The name of the method to call
         * @param {Array} [params] A list of optional params to pass to the called method
         * @returns {*} Returns the callee result
         */
        applyPlugin : function(action, params) {
            var $element = this.$element;
            var $plugin = $element && $element[this.pluginName]();

            if ($plugin) {
                return $plugin[action].apply($plugin, params);
            }
        },

        /**
         * Fires an event handler.
         * @param {String} eventName The name of the event to trigger
         * @param {Array} [params] A list of optional parameters
         * @returns {*} Returns the call result
         */
        trigger : function(eventName, params) {
            arguments[0] = this.adjustEventName(eventName);
            return this.applyElement('triggerHandler', arguments);
        },

        /**
         * Installs an event handler.
         * @param {String} eventName The name of the event to listen
         * @param {Function } callback The function called back when the event occurs
         * @returns {Autocompleter} this
         */
        on : function(eventName, callback) {
            arguments[0] = this.adjustEventName(eventName);
            this.applyElement('on', arguments);
            return this;
        },

        /**
         * Uninstalls an event handler.
         * @param {String} eventName The name of the event to release
         * @param {Function } [callback] The callback provided at install
         * @returns {Autocompleter} this
         */
        off : function(eventName, callback) {
            arguments[0] = this.adjustEventName(eventName);
            this.applyElement('off', arguments);
            return this;
        },

        /**
         * Gets the nested element on which the component is installed.
         * @returns {*|jQuery|HTMLElement}
         */
        getElement : function() {
            return this.$element;
        },

        /**
         * Gets the field value.
         * @returns {String}
         */
        getValue : function() {
            return this.value;
        },

        /**
         * Sets the field value.
         * @param {String} value The value to set inside the field
         * @param {String} label The label to display inside the field
         * @returns {Autocompleter} this
         */
        setValue : function(value, label) {
            this.value = value;
            if (!_.isUndefined(label)) {
                this.setLabel(label);
            }
            return this;
        },

        /**
         * Gets the displayed label.
         * @returns {String}
         */
        getLabel : function() {
            return this.label;
        },

        /**
         * Sets the displayed label.
         * @param {String} label The label to display inside the field
         * @returns {Autocompleter} this
         */
        setLabel : function(label) {
            this.label = label;
            if (this.$element) {
                this.$element.val(label);
            }
            return this;
        },

        /**
         * Gets the URI of the target ontology.
         * @returns {String}
         */
        getOntology : function() {
            return this.ontology;
        },

        /**
         * Sets the URI of the target ontology.
         * @param {String} ontology
         * @returns {Autocompleter} this
         */
        setOntology : function(ontology) {
            this.ontology = ontology;
            return this;
        },

        /**
         * Gets the name of the field containing the value within the received data.
         * @returns {String}
         */
        getValueField : function() {
            return this.valueField;
        },

        /**
         * Sets the name of the field containing the value within the received data.
         * @param {String} valueField
         * @returns {Autocompleter} this
         */
        setValueField : function(valueField) {
            this.valueField = valueField;
            return this;
        },

        /**
         * Gets the name of the field containing the label within the received data.
         * @returns {String}
         */
        getLabelField : function() {
            return this.labelField;
        },

        /**
         * Sets the name of the field containing the label within the received data.
         * @param {String} labelField
         * @returns {Autocompleter} this
         */
        setLabelField : function(labelField) {
            this.labelField = labelField;
            return this;
        },

        /**
         * Gets the value of the isProvider option.
         * When set to true the component acts as a data provider.
         * In this mode, each time an item is selected from a list,
         * it will be directly removed from the input, so the listener
         * has to take care of the selected value and to add it in its own list.
         * @returns {Boolean}
         */
        getIsProvider : function() {
            return this.isProvider;
        },

        /**
         * Sets the value of the isProvider option.
         * When set to true the component acts as a data provider.
         * In this mode, each time an item is selected from a list,
         * it will be directly removed from the input, so the listener
         * has to take care of the selected value and to add it in its own list.
         * @param {Boolean} isProvider
         * @returns {Autocompleter} this
         */
        setIsProvider : function(isProvider) {
            this.isProvider = !!isProvider;
            return this;
        },

        /**
         * Gets the root for seach params.
         * When provided, all the search params are wrapped under the same root.
         * @returns {String}
         */
        getParamsRoot : function() {
            return this.paramsRoot;
        },

        /**
         * Set the root for seach params.
         * When provided, all the search params are wrapped under the same root.
         * @param {String} paramsRoot
         * @returns {Autocompleter} this
         */
        setParamsRoot : function(paramsRoot) {
            this.paramsRoot = paramsRoot;
            return this;
        },

        /**
         * Gets the list of extra params to be sent with the query.
         * @returns {Object}
         */
        getParams : function() {
            var params = _.merge({}, this.params || {});
            var searchParams = params;

            if (this.paramsRoot) {
                searchParams = params[this.paramsRoot] || {};
                params[this.paramsRoot] = searchParams;
            }

            if (this.ontology) {
                searchParams[this.ontologyParam] = this.ontology;
            }

            return params;
        },

        /**
         * Sets a list of extra params to be sent with the query.
         * @param {Object} params
         * @returns {Autocompleter} this
         */
        setParams : function(params) {
            this.params = params;
            return this;
        },

        /**
         * Gets the name of the param providing the searched pattern.
         * If paramsRoot has been defined, the param name will be wrapped.
         * @returns {String}
         */
        getQueryParam : function() {
            return this.adjustParam(this.queryParam);
        },

        /**
         * Sets the name of the param providing the searched pattern.
         * @param {String} queryParam
         * @returns {Autocompleter} this
         */
        setQueryParam : function(queryParam) {
            this.queryParam = queryParam;
            return this;
        },

        /**
         * Gets the name of the param providing the ontology URI.
         * If paramsRoot has been defined, the param name will be wrapped.
         * @returns {String}
         */
        getOntologyParam : function() {
            return this.adjustParam(this.ontologyParam);
        },

        /**
         * Sets the name of the param providing the ontology URI.
         * @param {String} ontologyParam
         * @returns {Autocompleter} this
         */
        setOntologyParam : function(ontologyParam) {
            this.ontologyParam = ontologyParam;
            return this;
        },

        /**
         * Gets the URL to data source
         * @returns {String}
         */
        getUrl : function() {
            return this.url;
        },

        /**
         * Sets the URL to data source
         * @param {String} url
         * @returns {Autocompleter} this
         */
        setUrl : function(url) {
            this.url = url;
            return this;
        },

        /**
         * Gets the request method. Can be either GET or POST, default to GET.
         * @returns {String}
         */
        getType : function() {
            return this.type || 'GET';
        },

        /**
         * Sets the request method. Can be either GET or POST, default to GET.
         * @param {String} type
         * @returns {Autocompleter} this
         */
        setType : function(type) {
            this.type = type;
            return this;
        },

        /**
         * Gets the number of miliseconds to defer ajax request.
         * @returns {number}
         */
        getDelay : function() {
            return this.delay;
        },

        /**
         * Sets the number of miliseconds to defer ajax request.
         * @param {Number} delay
         * @returns {Autocompleter}
         */
        setDelay : function(delay) {
            this.delay = Math.max(0, Number(delay));
            return this;
        },

        /**
         * Gets the minimum number of characters required to trigger the ajax request.
         * @returns {number}
         */
        getMinChars : function() {
            return this.minChars;
        },

        /**
         * Sets the minimum number of characters required to trigger the ajax request.
         * @param {Number} minChars
         * @returns {Autocompleter} this
         */
        setMinChars : function(minChars) {
            this.minChars = Math.max(1, Number(minChars));
            return this;
        },

        /**
         * Activates the component if it was deactivated before.
         * @returns {Autocompleter} this
         */
        enable : function() {
            this.applyPlugin('enable');
            return this;
        },

        /**
         * Deactivates the component.
         * @returns {Autocompleter} this
         */
        disable : function() {
            this.applyPlugin('disable');
            return this;
        },

        /**
         * Hides suggestions.
         * @returns {Autocompleter} this
         */
        hide : function() {
            this.applyPlugin('hide');
            return this;
        },

        /**
         * Clears suggestion cache and current suggestions.
         * @returns {Autocompleter} this
         */
        clear : function() {
            this.applyPlugin('clear');
            return this;
        },

        /**
         * Clears suggestion cache.
         * @returns {Autocompleter} this
         */
        clearCache : function() {
            this.applyPlugin('clearCache');
            return this;
        },

        /**
         * Resets the component:
         * - clears the current selection,
         * - clears suggestion cache and current suggestions,
         * - hides suggestions.
         * @returns {Autocompleter} this
         */
        reset : function() {
            this.setValue(null, '');
            this.applyPlugin('clear');
            this.applyPlugin('hide');
            return this;
        },

        /**
         * Fired when the user select a suggestion in the list.
         * @param {Object} suggestion
         * @private
         */
        _onSelect : function(suggestion) {
            var value = suggestion && suggestion.data;
            var label = suggestion && suggestion.value;

            if (false !== this.trigger('beforeSelectItem', [value, label, this])) {
                this.value = value;
                this.label = label;

                if (this.isProvider) {
                    this.$element.val('');
                    this.applyPlugin('clear');
                }

                this.trigger('selectItem', [value, label, this]);
            } else {
                return false;
            }
        },

        /**
         * Fired when the user input text and a query is about to be requested.
         * @param {Object} params The list of params which will be bound the query
         * @private
         */
        _onSearchStart : function(params) {
            var queryParam = this.getQueryParam();
            var query;

            if (false !== this.trigger('searchStart', [params, this])) {
                if (params && params[queryParam]) {
                    query = params[queryParam] || '';
                    if (query.substr(-1) !== '*') {
                        query += '*';
                    }
                    params[queryParam] = query;
                }
            } else {
                return false;
            }
        },

        /**
         * Fired after ajax response is processed.
         * @param {String} query The requested fragment
         * @param {Object} suggestions An array containing the results.
         * @private
         */
        _onSearchComplete : function(query, suggestions) {
            return this.trigger('searchComplete', [query, suggestions, this]);
        },

        /**
         * Fired if ajax request fails.
         * @param {String} query
         * @param {jqXHR} jqXHR
         * @param {String} textStatus
         * @param {Exception} errorThrown
         * @private
         */
        _onSearchError : function(query, jqXHR, textStatus, errorThrown) {
            return this.trigger('searchError', [query, jqXHR, textStatus, errorThrown, this]);
        },

        /**
         * Fired when input is altered after selection has been made.
         * @private
         */
        _onInvalidateSelection : function() {
            return this.trigger('invalidateSelection', [this]);
        },

        /**
         * Fired before displaying the suggestions.
         * You may manipulate suggestions DOM before it is displayed.
         * @param {jQuery} $container
         * @private
         */
        _onBeforeRender : function($container) {
            this.trigger('beforeRender', [$container, this]);
        },

        /**
         * Adjusts the received data to comply to plugin needs
         * @param response
         * @returns {{suggestions: Array}}
         */
        _transformResult : function(response) {
            var that = this;
            var results = {
                suggestions: []
            };

            if (_.isString(response)) {
                response = JSON.parse(response);
            }
            if (response.records) {
                results.suggestions = _.map(response.data, function(dataItem) {
                    return {
                        value : dataItem[that.labelField],
                        data : dataItem[that.valueField]
                    };
                });
            }

            return results;
        },

        /**
         * Adjusts a param name: if paramsRoot has been defined, the param name will be wrapped.
         * @param {String} param
         * @returns {String}
         */
        adjustParam : function(param) {
            if (this.paramsRoot) {
                param = this.paramsRoot + '[' + param + ']';
            }
            return param;
        },

        /**
         * Adjusts an event name
         * @param {string} eventName
         * @returns {string}
         */
        adjustEventName : function(eventName) {
            eventName = eventName.toLowerCase();
            if (-1 === eventName.indexOf('.')) {
                eventName += '.' + NS;
            }
            return eventName;
        }
    };

    /**
     * Capitalizes the first letter of the provided string.
     * @param {String} s The string to capitalize
     * @returns {String} Returns the capitalized version of the string
     */
    var capitalize = function(s) {
        if (s) {
            s = s.charAt(0).toUpperCase() + s.substr(1);
        }
        return s || '';
    };

    /**
     * Installs the autocompleter onto an element.
     * @param {jQuery|Element|String} $element The element on which install the autocompleter
     * @param {Object} options A list of options to set
     * @returns {Autocompleter} Returns the instance of the autocompleter component
     */
    var autocompleteFactory = function($element, options) {
        var autocomplete = _.clone(Autocompleter, true);
        _.defaults(autocomplete, Defaults);
        return autocomplete.init($element, options);
    };

    return autocompleteFactory;

});