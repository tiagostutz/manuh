// Following MQTT wildcard spec
//http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718107

var debug = require('debug')('debug');
var log = require('debug')('log');
var simpleStorage = require('./simpleStorage');
debug('simpleStorage', simpleStorage);

var _manuhData = {

    retainedStorage: typeof(window) != 'undefined' && window && window.localStorage ? window.localStorage : simpleStorage,
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

    __publishCallbackInvokeIntervalDelay: 1, //mainly used for development porpuses
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
                if (this.subscriptions.filter(function(s) { return  s.target == target;}).length == 0) { //avoid subscription duplicated
                    this.subscriptions.push({ target: target, onMessageReceived: onMessageReceived});
                }
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
        var arrTopicNames = topicPath.split(/\/(.+)/);

        var firstLevelName = topicPath;
        if (arrTopicNames.length > 1) {
            firstLevelName = arrTopicNames[0];
        }
        if (firstLevelName.trim().length === 0) {
            return null;
        }

        if (!topicNode.hasOwnProperty(firstLevelName)) {
            topicNode[firstLevelName] = _manuhFunctions._createTopic(firstLevelName, topicNode);
        }

        arrTopics.push(topicNode[firstLevelName]);
        if (arrTopicNames.length > 1) {
            var topics = __resolveTopicsByPathRegex(arrTopicNames[1], topicNode[firstLevelName]);
            arrTopics = arrTopics.concat(topics);
        }

        return arrTopics;
    },

    _resolveTopic: function (topicPath) {
        var arrTopics = _manuhFunctions._resolveTopicsByPathRegex(topicPath);
        return arrTopics[arrTopics.length - 1]; //return only the last topic found, that will be the last one on the path
    },

    _multicastMessage: function (topicToPublish, message, retained) {
        var invokeCallbackIsolated = function (subsc) {
            var _subsc = subsc;
            debug("invokeCallbackIsolated async...");
            setTimeout(function () {
                debug('invokeCallbackIsolated timeout triggered!');
                var info = {};
                if (typeof(retained) != 'undefined') {
                    info.retained = retained;
                }
                debug('Calling subscription `onMessageReceived`. Message: ', message, " Info:", info);
                _subsc.onMessageReceived(message, info);
            }, _manuhData.__publishCallbackInvokeIntervalDelay);
        };

        for (var k = 0; k < topicToPublish.subscriptions.length; k++) {
            //invoke the callbacks asynchronously and with a closed scope
            var subscription = topicToPublish.subscriptions[k];
            debug("Inoking for subscription " + k + " - target: " + subscription.target);
            new invokeCallbackIsolated(subscription);
        }
    }

};
module.exports = {

    publish: function (topicPath, message, options) {
        debug("calling `publish` with params: ", topicPath, message, options);
        var topicsToPublish = [];
        var mainTopic = null;

        if (!_manuhFunctions._hasSpecialWildcard(topicPath)) {
            debug("NO special wildcard detected.")
            mainTopic = _manuhFunctions._resolveTopic(topicPath);
            if (mainTopic.length > 1) {
                throw {msg: 'Error to publish message on topic because there were found more than 1 topic for the provied topicPath. You can publish only to one topic. Check if there are duplicated topic names.'};
            }
            topicsToPublish.push(mainTopic);
            debug("topicsToPublish afeter resolving mainTopic: ", topicsToPublish);

        } else { //if the path has a wildcard that needs to be evaluated
            throw {msg: 'Error to publish message on topic because the topic name (path) provided has invalid characters. Note: you cannot publish using wildcards like you can use on subscriptions.'};
        }

        var invokeCallbackIsolated = function (subsc) {
            var _subsc = subsc;
            setTimeout(function () {
                _subsc.onMessageReceived(message);
            }, _manuhData.__publishCallbackInvokeIntervalDelay);
        };

        if (options && options.retained) {
            if (!options.retainment_provider || options.retainment_provider == 'memory') {
                debug("`memory` retaintion provider being used");
                mainTopic.retainedMessage = message;

            } else if (options.retainment_provider == 'localStorage') {
                debug("`localStorage` retaintion provider being used");
                var key = '[manuh-retained]' + _manuhFunctions._getTopicPath(mainTopic);
                debug('publish retained ' + key);
                _manuhData.retainedStorage.setItem(key, JSON.stringify(message));
            } else {
                throw 'options.retainment_provider must be one of ["memory", "localStorage"]';
            }
        }

        // publish in the main topic and in the derivated topics
        var findAllWildcardTopics = function (topic) {
            debug("finding the mainand the derivated topics based on the wildcard");
            if (!topic) {
                return [];
            }
            var wildcardTopics = [];
            var topicTemplate = _manuhFunctions._createTopic('temp', null); //create a topic to get the attributes that are not nother topics
            var topicAttributeNames = Object.keys(topicTemplate);

            var childTopics = Object.keys(topic)
                .map(function (attr) {
                    return (topicAttributeNames.indexOf(attr) == -1) ? attr : null;
                })
                .reduce(function (a, b) {
                    if (b != null) {
                        a.push(b);
                    }
                    return a;
                }, []);

            childTopics.map(function (topicName) {
                if (topicName == '#') { //has wildcard
                    wildcardTopics.push(topic[topicName]);
                } else {
                    wildcardTopics = wildcardTopics.concat(findAllWildcardTopics(topic.parent));
                }
            });
            return wildcardTopics;

        };
        var wildCardTopicsFound = findAllWildcardTopics(mainTopic.parent);
        topicsToPublish = topicsToPublish.concat(wildCardTopicsFound);

        debug("topics to publish found: ", topicsToPublish);
        topicsToPublish.map(function(topic) {
            debug("publishing to topic `" + topic + "`");
            _manuhFunctions._multicastMessage(topic, message, false);
        });

    },

    __doSubscribe: function (topicPathRegex, target, onMessageReceived, onSubscribed) {
        if (!onMessageReceived) {
            throw { msg: 'Error subscribing to `' + topicPathRegex + '` because no `onMessageReceived` callback function was provided.' };
        }

        var retainedMessage = null;
        var topicToSubscribe = null;

        topicToSubscribe = _manuhFunctions._resolveTopic(topicPathRegex);
        topicToSubscribe.addSubscription(target, onMessageReceived); //if there aren't wildcards on the topicPath, them it will be a subscription for only one topic
        
        //lookup for retained messages in memory
        if (topicToSubscribe.retainedMessage) {
            retainedMessage = topicToSubscribe.retainedMessage;
            _manuhFunctions._multicastMessage(topicToSubscribe, topicToSubscribe.retainedMessage, true);
            //lookup for retained messages on local-storage
        } else {
            var key = '[manuh-retained]' + _manuhFunctions._getTopicPath(topicToSubscribe);
            var message = _manuhData.retainedStorage.getItem(key);
            if (message) {
                var data = message;
                try { 
                    data = JSON.parse(message);
                } catch(e){
                    data = message;
                }
                retainedMessage = data;
                _manuhFunctions._multicastMessage(topicToSubscribe, data, true);
            }
        }
        if (onSubscribed) {
            onSubscribed();
        }
        return retainedMessage;
    },
    subscribe: function (topicPathRegex, target, onMessageReceived, onSubscribed) {

        //if `onSubscribed` callback provided, make the subscription async
        var _self = this;
        if (onSubscribed) {
            setTimeout(function() {
                _self.__doSubscribe(topicPathRegex, target, onMessageReceived, onSubscribed);
            }, 0);
        }else{
           return _self.__doSubscribe(topicPathRegex, target, onMessageReceived, onSubscribed);
        }
    },

    asyncSubscribe: function (topicPathRegex, target, onMessageReceived, onSubscribed) {
        if (!onSubscribed) {
            onSubscribed = function(){};
        }
        this.subscribe(topicPathRegex, target, onMessageReceived, onSubscribed);
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
