// Following MQTT wildcard spec
//http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718107

var debug = require('debug')('debug');
var log = require('debug')('log');
var simpleStorage = require('./simpleStorage');
debug('simpleStorage', simpleStorage);

var _manuhData = {

    retainedStorage: typeof(window) != 'undefined' ? window.localStorage : simpleStorage,
    /*
    ·         “sport/tennis/player1”
    ·         “sport/tennis/player1/ranking”
    ·         “sport/tennis/player1/score/wimbledon”
    */
    levelSeparator: "/",

    /*
    ·         “sport/#” also matches the singular “sport”, since # includes the parent level.
    ·         “#” is valid and will receive every Application Message
    ·         “sport/tennis/#” is valid
    ·         “sport/tennis#” is not valid
    ·         “sport/tennis/#/ranking” is not valid
    */
    multiLevelWildCard: "#",

    /*
    ·         “+” is valid
    ·         “+/tennis/#” is valid
    ·         “sport+” is not valid
    ·         “sport/+/player1” is valid
    ·         “/finance” matches “+/+” and “/+”, but not “+”
    */
    singleLevelWildCard: "+",

    topicsTree: {},

    __publishCallbackInvokeIntervalDelay: 0, //mainly used for development porpuses
};

var _manuhFunctions = {
    _hasSpecialWildcard: function _hasSpecialWildcard(str) {
        return str.indexOf(_manuhData.multiLevelWildCard) != -1 || str.indexOf(_manuhData.singleLevelWildCard) != -1;
    },

    _createTopic: function _createTopic(_name, _parent) {
        var topic = {
            name: _name,
            parent: _parent,
            retainedMessage: null,
            subscriptions: [],
            addSubscription: function (target, onMessageReceived) {
                this.subscriptions.push({ target: target, onMessageReceived: onMessageReceived});
            }
        };

        if (_parent) {
            _parent[_name] = topic;
        }

        return topic;
    },

    _getTopicPath: function __getTopicPath(topicNode) {
        debug('getTopicPath ', topicNode);
        if (topicNode.parent == null) {
            return '';
        } else {
            var parentName = __getTopicPath(topicNode.parent);
            return parentName + (parentName != '' ? '/' : '') + topicNode.name;
        }
    },

    //returns an array with all matched topics
    _resolveTopicsByPathRegex: function __resolveTopicsByPathRegex(topicPath, topicNode, remove) {
        var arrTopics = [];
        if (!topicNode) {
            topicNode = _manuhData.topicsTree;
        }
        log('=====topicNode', topicNode);

        var arrTopicNames = topicPath.split(/\/(.+)/);
        log('=====arrTopicNames', topicPath, arrTopicNames);

        var firstLevelName = topicPath;
        if (arrTopicNames.length > 1) {
            firstLevelName = arrTopicNames[0];
        }
        log('firstLevelName', firstLevelName);
        if (firstLevelName.trim().length === 0) {
            return null;
        }

        if (firstLevelName == '#') { //its a wildcard so we need to find all the subtopics of the current `topicNode`
            var topicTemplate = _manuhFunctions._createTopic('temp',null); //create a topic to get the attributes that are not nother topics
            var topicAttributeNames = Object.keys(topicTemplate);
            
            var subtopicsNames = Object.keys(topicNode).map(function(attr) { 
                                                    return (topicAttributeNames.indexOf(attr) == -1) ? attr : null;
                                                 })
                                                .reduce(function(a,b) { 
                                                    if(b!=null) { 
                                                        a.push(b); 
                                                    } 
                                                    return a;
                                                }, [] );
            log('subtopicsNames==> ',subtopicsNames);
            if (subtopicsNames.length > 0) {
                subtopicsNames.map(function(subtopicName) {
                    log(subtopicName + '/#::', subtopicName + '/#')
                    var topics = __resolveTopicsByPathRegex(subtopicName + '/#', topicNode);
                    log('topics WITH SUBTOPICS', topics);
                    arrTopics = arrTopics.concat(topics);
                });
            }
        }else{
            
            if (!topicNode.hasOwnProperty(firstLevelName)) {
                log('CREATING TOPIC....', firstLevelName);
                topicNode[firstLevelName] = _manuhFunctions._createTopic(firstLevelName, topicNode);
            }

            log('PUSHING:::::', topicNode[firstLevelName])
            arrTopics.push(topicNode[firstLevelName]);
            if (arrTopicNames.length > 1) {
                var topics = __resolveTopicsByPathRegex(arrTopicNames[1], topicNode[firstLevelName]);
                arrTopics = arrTopics.concat(topics);
            }
        }

        log('arrTopics', arrTopics);
        return arrTopics;
    },

    _resolveTopic: function (topicPath) {
        if (!_manuhFunctions._hasSpecialWildcard(topicPath)) {
            var arrTopics = _manuhFunctions._resolveTopicsByPathRegex(topicPath);
            return arrTopics[arrTopics.length - 1]; //return only the last topic found, that will be the last one on the path
        } else {
            throw {msg: 'Error to resolve a topic by the path provided because it has a wildcard and hence could find 2 or more topcis. This method is intended to be used to get only one topic. To resolve path using wildcards use `_resolveTopicsByPathRegex`.'};
        }
    },

    _multicastMessage: function (topicToPublish, message) {
        var invokeCallbackIsolated = function (subsc) {
            var _subsc = subsc;
            setTimeout(function () {
                debug('>>>>>> CALLING ONMESSAGE ');
                _subsc.onMessageReceived(message);
            }, _manuhData.__publishCallbackInvokeIntervalDelay);
        };

        for (var k = 0; k < topicToPublish.subscriptions.length; k++) {
            //invoke the callbacks asynchronously and with a closed scope
            var subscription = topicToPublish.subscriptions[k];
            debug('>>>>>> INVOKE ' + k);
            new invokeCallbackIsolated(subscription);
        }
    }

};
module.exports = {

    publish: function (topicPath, message, options) {
        var _self = this;
        var topicToPublish = null;

        if (!_manuhFunctions._hasSpecialWildcard(topicPath)) {
            topicToPublish = _manuhFunctions._resolveTopic(topicPath);

        } else { //if the path has a wildcard that needs to be evaluated
            throw {msg: 'Error to publish message on topic because the topic name (path) provided has invalid characters. Note: you cannot publish using wildcards like you can use on subscriptions.'};
        }
        if (topicToPublish.length > 1) {
            throw {msg: 'Error to publish message on topic because there were found more than 1 topic for the provied topicPath. You can publish only to one topic. Check if there are duplicated topic names.'};
        }

        var invokeCallbackIsolated = function (subsc) {
            var _subsc = subsc;
            setTimeout(function () {
                _subsc.onMessageReceived(message);
            }, _manuhData.__publishCallbackInvokeIntervalDelay);
        };

        if (options && options.retained) {
            if (!options.retainment_provider || options.retainment_provider == 'memory') {
                topicToPublish.retainedMessage = message;

            } else if (options.retainment_provider == 'localStorage') {
                var key = '[manuh-retained]' + _manuhFunctions._getTopicPath(topicToPublish);
                debug('publish retained ' + key);
                _manuhData.retainedStorage.setItem(key, JSON.stringify(message));
            } else {
                throw 'options.retainment_provider must be one of ["memory", "localStorage"]';
            }
        }

        _manuhFunctions._multicastMessage(topicToPublish, message);

    },

    subscribe: function (topicPathRegex, target, onMessageReceived) {
        if (!onMessageReceived) {
            throw {msg: 'Error subscribing to `' + topicPathRegex + '` because no `onMessageReceived` callback function was provided.'};
        }

        var topicToSubscribe = null;

        if (!_manuhFunctions._hasSpecialWildcard(topicPathRegex)) {
            topicToSubscribe = _manuhFunctions._resolveTopic(topicPathRegex);
            topicToSubscribe.addSubscription(target, onMessageReceived);//if there aren't wildcards on the topicPath, them it will be a subscription for only one topic

            //lookup for retained messages in memory
            if (topicToSubscribe.retainedMessage) {
                _manuhFunctions._multicastMessage(topicToSubscribe, topicToSubscribe.retainedMessage);
                //lookup for retained messages on local-storage
            } else {
                var key = '[manuh-retained]' + _manuhFunctions._getTopicPath(topicToSubscribe);
                var message = _manuhData.retainedStorage.getItem(key);
                if (message) {
                    _manuhFunctions._multicastMessage(topicToSubscribe, JSON.parse(data));
                }
            }
        } else { //if the path has a wildcard that needs to be evaluated
            topicsToSubscribe = _manuhFunctions._resolveTopicsByPathRegex(topicPathRegex);
            topicsToSubscribe.map(function (topic) {
                topic.addSubscription(target, onMessageReceived);

                //lookup for retained messages in memory
                if (topic.retainedMessage) {
                    _manuhFunctions._multicastMessage(topic, topic.retainedMessage);
                    //lookup for retained messages on local-storage
                } else {
                    var key = '[manuh-retained]' + _manuhFunctions._getTopicPath(topic);
                    var message = JSON.parse(_manuhData.retainedStorage.getItem(key));
                    if (message) {
                        _manuhFunctions._multicastMessage(topic, message);
                    }
                }
            });//if there aren't wildcards on the topicPath, them it will be a subscription for only one topic

        }
    },

    unsubscribe: function (topicPathRegex, target) {
        var topicToSubscribe = null;
        if (!_manuhFunctions._hasSpecialWildcard(topicPathRegex)) {
            topicToSubscribe = _manuhFunctions._resolveTopic(topicPathRegex);
            topicToSubscribe.subscriptions = topicToSubscribe.subscriptions.filter(function(obj) {
                return obj.target !== target;
            });
        } else { //if the path has a wildcard that needs to be evaluated
            throw 'Wildcard paths not supported for subscriptions yet';    
        }
    }

};
module.exports.manuhData = _manuhData;
module.exports.manuhFunctions = _manuhFunctions;