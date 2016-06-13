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
 * Copyright (c) 2016 (original work) Open Assessment Technologies SA ;
 */

/**
 * Test the indexdb store backend
 * @author Bertrand Chevrier <bertrand@taotesting.com>
 */
define(['core/store/localstorage', 'core/promise'], function(localStorageBackend, Promise){
    'use strict';

    QUnit.module('API');

    QUnit.test("module", function(assert){
        QUnit.expect(2);

        assert.ok(typeof localStorageBackend !== 'undefined', "The module exports something");
        assert.ok(typeof localStorageBackend === 'function', "The module exposes a function");
    });

    QUnit.test("factory", function(assert){
        QUnit.expect(4);

        assert.throws(function(){
            localStorageBackend();
        }, TypeError, 'The backend should be created with a store id');

        assert.throws(function(){
            localStorageBackend(false);
        }, TypeError, 'The backend should be created with a valid store id');

        var store = localStorageBackend('foo');

        assert.equal(typeof store, 'object', 'The factory return an object');
        assert.notDeepEqual(localStorageBackend('foo'), store, 'The factory creates a new object');
    });

    QUnit.test("store", function(assert){
        QUnit.expect(7);
        var store = localStorageBackend('foo');

        assert.equal(typeof store, 'object', 'The store is an object');
        assert.equal(typeof store.getItem, 'function', 'The store exposes the getItem method');
        assert.equal(typeof store.setItem, 'function', 'The store exposes the setItem method');
        assert.equal(typeof store.getLastActivity, 'function', 'The store exposes the getLastActivity method');
        assert.equal(typeof store.removeItem, 'function', 'The store exposes the removetItem method');
        assert.equal(typeof store.clear, 'function', 'The store exposes the clear method');
        assert.equal(typeof store.removeStore, 'function', 'The store exposes the removeStore method');

    });


    QUnit.module('CRUD');

    QUnit.asyncTest("setItem", function(assert){
        QUnit.expect(5);

        var store = localStorageBackend('foo');
        var startTs = Date.now();
        assert.equal(typeof store, 'object', 'The store is an object');

        var p = store.setItem('bar', 'boz');
        assert.ok(p instanceof Promise, 'setItem returns a Promise');

        p.then(function(result){

            assert.equal(typeof result, 'boolean', 'The result is a boolean');
            assert.ok(result, 'The item is added');

            store.getLastActivity().then(function(timestamp) {
                assert.ok(timestamp >= startTs && timestamp <= Date.now(), 'The last activity timestamp has been updated');
                QUnit.start();
            });
        }).catch(function(err){
            assert.ok(false, err);
            QUnit.start();
        });
    });

    QUnit.asyncTest("getItem", function(assert){
        QUnit.expect(5);

        var store = localStorageBackend('foo');
        assert.equal(typeof store, 'object', 'The store is an object');

        var p = store.setItem('bar', 'noz');
        assert.ok(p instanceof Promise, 'setItem returns a Promise');

        p.then(function(result){
            assert.ok(result, 'The item is added');

            store.getItem('bar').then(function(value){

                assert.equal(typeof value, 'string', 'The result is a string');
                assert.equal(value, 'noz', 'The retrieved value is correct');

                QUnit.start();
            });
        }).catch(function(err){
            assert.ok(false, err);
            QUnit.start();
        });
    });

    QUnit.asyncTest("removeItem", function(assert){
        QUnit.expect(5);

        var store = localStorageBackend('foo');
        assert.equal(typeof store, 'object', 'The store is an object');

        store.setItem('moo', 'noob')
        .then(function(result){
            assert.ok(result, 'The item is added');

            return store.getItem('moo').then(function(value){
                assert.equal(value, 'noob', 'The retrieved value is correct');
            });
        }).then(function(){
            return store.removeItem('moo').then(function(rmResult){
                    assert.ok(rmResult, 'The item is removed');
                });
        }).then(function(){
            return store.getItem('moo').then(function(value){
                assert.equal(typeof value, 'undefined', 'The value does not exists anymore');
                QUnit.start();
            });
        }).catch(function(err){
            assert.ok(false, err);
            QUnit.start();
        });
    });

    QUnit.asyncTest("object", function(assert){
        QUnit.expect(3);

        var sample = {
            collection : [{
                item1: true,
                item2: 'false',
                item3: 12
            },{
                item4: { value : null }
            }]
        };
        var store = localStorageBackend('foo');
        assert.equal(typeof store, 'object', 'The store is an object');

        store.setItem('sample', sample).then(function(added){
            assert.ok(added, 'The item is added');
            store.getItem('sample').then(function(result){
                assert.deepEqual(result, sample, 'Retrieving the sample');
                QUnit.start();
            });
        }).catch(function(err){
            assert.ok(false, err);
            QUnit.start();
        });
    });

    QUnit.asyncTest("clear", function(assert){
        QUnit.expect(5);

        var store = localStorageBackend('foo');
        assert.equal(typeof store, 'object', 'The store is an object');

        Promise.all([
            store.setItem('zoo', 'zoob'),
            store.setItem('too', 'toob')
        ])
        .then(function(){
            return store.getItem('too').then(function(value){
                assert.equal(value, 'toob', 'The retrieved value is correct');
            });
        }).then(function(){
            return store.clear().then(function(rmResult){
                    assert.ok(rmResult, 'The item is removed');
                });
        }).then(function(){
            return store.getItem('too').then(function(value){
                assert.equal(typeof value, 'undefined', 'The value does not exists anymore');
                return store.getItem('zoo').then(function(value){
                    assert.equal(typeof value, 'undefined', 'The value does not exists anymore');
                    QUnit.start();
                });
            });
        }).catch(function(err){
            assert.ok(false, err);
            QUnit.start();
        });
    });


    QUnit.module('Erase');

    QUnit.asyncTest("removeStore", function (assert) {
        QUnit.expect(5);

        var store = localStorageBackend('foo');
        assert.equal(typeof store, 'object', 'The store is an object');

        Promise.all([
            store.setItem('zoo', 'zoob'),
            store.setItem('too', 'toob')
        ])
            .then(function () {
                return store.getItem('too').then(function (value) {
                    assert.equal(value, 'toob', 'The retrieved value is correct');
                });
            })
            .then(function () {
                return store.removeStore().then(function (rmResult) {
                    assert.ok(rmResult, 'The item is removed');
                });
            })
            .then(function () {
                return store.getItem('too').then(function (value) {
                    assert.equal(typeof value, 'undefined', 'The value does not exists anymore');
                    return store.getItem('zoo').then(function (value) {
                        assert.equal(typeof value, 'undefined', 'The value does not exists anymore');
                        QUnit.start();
                    });
                });
            })
            .catch(function (err) {
                assert.ok(false, err);
                QUnit.start();
            });
    });

    QUnit.asyncTest("clean", function (assert) {
        QUnit.expect(18);

        var store1 = localStorageBackend('foo1');
        var store2 = localStorageBackend('foo2');
        var store3 = localStorageBackend('foo3');

        assert.equal(typeof store1, 'object', 'The store1 is an object');
        assert.equal(typeof store2, 'object', 'The store2 is an object');
        assert.equal(typeof store3, 'object', 'The store3 is an object');

        Promise.all([
            store1.setItem('zoo', 'zooa'),
            store1.setItem('too', 'tooa'),

            store2.setItem('zoo', 'zoob'),
            store2.setItem('too', 'toob'),

            store3.setItem('zoo', 'zooc'),
            store3.setItem('too', 'tooc')
        ])
            .then(function () {
                return store1.getItem('too').then(function (value) {
                    assert.equal(value, 'tooa', 'The value of too retrieved from store1 is correct');
                    return store1.getItem('zoo').then(function (value) {
                        assert.equal(value, 'zooa', 'The value of zoo retrieved from store1 is correct');
                    });
                });
            })
            .then(function () {
                return store2.getItem('too').then(function (value) {
                    assert.equal(value, 'toob', 'The value of too retrieved from store2 is correct');
                    return store2.getItem('zoo').then(function (value) {
                        assert.equal(value, 'zoob', 'The value of zoo retrieved from store2 is correct');
                    });
                });
            })
            .then(function () {
                return store3.getItem('too').then(function (value) {
                    assert.equal(value, 'tooc', 'The value of too retrieved from store3 is correct');
                    return store3.getItem('zoo').then(function (value) {
                        assert.equal(value, 'zooc', 'The value of zoo retrieved from store3 is correct');
                    });
                });
            })
            .then(function () {
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        store3.setItem('foo', 'fooc').then(function () {
                            localStorageBackend.clean(250).then(resolve).catch(reject);
                        }).catch(reject);
                    }, 300);
                });
            })
            .then(function (rmResult) {
                assert.ok(rmResult, 'The old storage are removed');
            })
            .then(function () {
                return store1.getItem('too').then(function (value) {
                    assert.equal(typeof value, 'undefined', 'The value too does not exist anymore in store1');
                    return store1.getItem('zoo').then(function (value) {
                        assert.equal(typeof value, 'undefined', 'The value zoo does not exist anymore in store1');
                    });
                });
            })
            .then(function () {
                return store2.getItem('too').then(function (value) {
                    assert.equal(typeof value, 'undefined', 'The value too does not exist anymore in store2');
                    return store2.getItem('zoo').then(function (value) {
                        assert.equal(typeof value, 'undefined', 'The value zoo does not exist anymore in store2');
                    });
                });
            })
            .then(function () {
                return store3.getItem('too').then(function (value) {
                    assert.equal(value, 'tooc', 'The value too still exists in store3');
                    return store3.getItem('zoo').then(function (value) {
                        assert.equal(value, 'zooc', 'The value zoo still exists in store3');
                        return store3.getItem('foo').then(function (value) {
                            assert.equal(value, 'fooc', 'The value foo still exists in store3');
                        });
                    });
                });
            })
            .then(function () {
                return store3.removeStore().then(function (rmResult) {
                    assert.ok(rmResult, 'The item is removed');
                    QUnit.start();
                });
            })
            .catch(function (err) {
                assert.ok(false, err);
                QUnit.start();
            });
    });
});



