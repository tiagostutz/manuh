// Following MQTT wildcard spec
//http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718107

var _manuhData = {

    /*
    ·         “sport/tennis/player1”
    ·         “sport/tennis/player1/ranking”
    ·         “sport/tennis/player1/score/wimbledon”
    */
    levelSeparator : "/",

    /*
    ·         “sport/#” also matches the singular “sport”, since # includes the parent level.
    ·         “#” is valid and will receive every Application Message
    ·         “sport/tennis/#” is valid
    ·         “sport/tennis#” is not valid
    ·         “sport/tennis/#/ranking” is not valid
    */
    multiLevelWildCard : "#",

    /*
    ·         “+” is valid
    ·         “+/tennis/#” is valid
    ·         “sport+” is not valid
    ·         “sport/+/player1” is valid
    ·         “/finance” matches “+/+” and “/+”, but not “+”
    */
    singleLevelWildCard : "+",

    topicsTree : {},

    __publishCallbackInvokeIntervalDelay : 0, //mainly used for development porpuses

}

var _manuhFunctions = {
    _hasSpecialWildcard : function _hasSpecialWildcard(str) {
        return str.indexOf(_manuhData.multiLevelWildCard)!=-1 || str.indexOf(_manuhData.singleLevelWildCard)!=-1;
    },

    _createTopic: function _createTopic(_name, _parent) {
        var topic = {
            name : _name,
            parent : _parent,
            retainedMessage: null,
            subscriptions : [],
            addSubscription: function(onMessageReceived) {
                this.subscriptions.push({onMessageReceived : onMessageReceived});
            },
        };

        if (_parent) {
            _parent[_name] = topic;
        }

        return topic;
    },

    _getTopicPath: function __getTopicPath(topicNode) {
      console.log('getTopicPath ' + JSON.stringify(topicNode, function(key, value) {
        if(key == 'parent') {return value.id;}
        else {return value;}
      }));
      if(topicNode.parent==null) {
        return '';
      } else {
        var parentName = __getTopicPath(topicNode.parent);
        return parentName + (parentName!=''?'/':'') + topicNode.name;
      }
    },

    //returns an array with all matched topics
    _resolveTopicsByPathRegex : function __resolveTopicsByPathRegex(topicPath, topicNode) {
      var arrTopics = [];
      if (!topicNode) {
          topicNode = _manuhData.topicsTree;
      }

      var idxHash = topicPath.indexOf("/");

      var firstLevelName = topicPath;
      if (idxHash!=-1) {
          firstLevelName = topicPath.substring(0, topicPath.indexOf("/"));
      }
      if (firstLevelName.trim().length === 0) {
          return null;
      }

      if (!topicNode.hasOwnProperty(firstLevelName)) {
          topicNode[firstLevelName] = _manuhFunctions._createTopic(firstLevelName, topicNode);
      }

      arrTopics.push(topicNode[firstLevelName]);
      if (idxHash!=-1) {
          var topics = __resolveTopicsByPathRegex(topicPath.substring(idxHash+1), topicNode[firstLevelName]);
          arrTopics = arrTopics.concat(topics);
      }

      return arrTopics;
    },

    _resolveTopic : function(topicPath) {
      if (!_manuhFunctions._hasSpecialWildcard(topicPath)) {
          var arrTopics = _manuhFunctions._resolveTopicsByPathRegex(topicPath);
          return arrTopics[arrTopics.length-1]; //return only the last topic found, that will be the last one on the path
      }else{
          throw {msg: 'Error to resolve a topic by the path provided because it has a wildcard and hence could find 2 or more topcis. This method is intended to be used to get only one topic. To resolve path using wildcards use `_resolveTopicsByPathRegex`.'};
      }
    },

    _multicastMessage: function(topicToPublish, message) {
      var invokeCallbackIsolated = function(subsc) {
          var _subsc = subsc;
          setTimeout(function() {
              console.log('>>>>>> CALLING ONMESSAGE ');
              _subsc.onMessageReceived(message);
          }, _manuhData.__publishCallbackInvokeIntervalDelay);
      };

      for(var k=0; k<topicToPublish.subscriptions.length; k++) {
          //invoke the callbacks asynchronously and with a closed scope
          var subscription = topicToPublish.subscriptions[k];
          console.log('>>>>>> INVOKE ' + k);
          new invokeCallbackIsolated(subscription);
      }
    }


};

module.exports = {

    /*
     * Publishes a message to a topic.
     * options: {
     *    retained: true  - whetever to keep this message and deliver to new subscribers as soon as they subscribe or not
     *    retainment_provider: 'memory', 'localStorage' or another string registered with manuh.registerRetainProvider(name, function);
     * }
     */
    publish: function(topicPath, message, options) {
        console.log('PUBLISH ' + topicPath + '=' + JSON.stringify(message) + ' ' + JSON.stringify(options));
        var _self = this;
        var topicToPublish = null;

        if (!_manuhFunctions._hasSpecialWildcard(topicPath)) {
            topicToPublish = _manuhFunctions._resolveTopic(topicPath);

        }else{ //if the path has a wildcard that needs to be evaluated
            throw {msg: 'Error to publish message on topic because the topic name (path) provided has invalid characters. Note: you cannot publish using wildcards like you can use on subscriptions.'};
        }
        if (topicToPublish.length > 1) {
            throw {msg: 'Error to publish message on topic because there were found more than 1 topic for the provied topicPath. You can publish only to one topic. Check if there are duplicated topic names.'};
        }

        if(options && options.retained) {

          if(!options.retainment_provider || options.retainment_provider=='memory') {
            topicToPublish.retainedMessage = message;

          } else if(options.retainment_provider=='localStorage') {
            var key = '[manuh-retained]' + _manuhFunctions._getTopicPath(topicToPublish);
            console.log('publish retained ' + key);
            localStorage.setItem(key, JSON.stringify(message));

          } else {
            throw 'options.retainment_provider must be one of ["memory", "localStorage"]';
          }
        }

        _manuhFunctions._multicastMessage(topicToPublish, message);

    },

    subscribe: function(topicPathRegex, onMessageReceived) {
      if (!onMessageReceived) {
          throw {msg: 'Error subscribing to `' + topicPathRegex + '` because no `onMessageReceived` callback function was provided.'};
      }

      var topicToSubscribe = null;

      console.log('subscribing to ' + topicPathRegex);
      if (!_manuhFunctions._hasSpecialWildcard(topicPathRegex)) {
          topicToSubscribe = _manuhFunctions._resolveTopic(topicPathRegex);
          topicToSubscribe.addSubscription(onMessageReceived);//if there aren't wildcards on the topicPath, them it will be a subscription for only one topic
          console.log('TOPICSUB ' + JSON.stringify(topicToSubscribe.retainedMessage));

          //lookup for retained messages in memory
          if(topicToSubscribe.retainedMessage) {
            console.log('multicasting retained message after subscription');
            _manuhFunctions._multicastMessage(topicToSubscribe, topicToSubscribe.retainedMessage);

          //lookup for retained messages on local-storage
          } else {
            var key = '[manuh-retained]' + _manuhFunctions._getTopicPath(topicToSubscribe);
            console.log('subscribe retained ' + key);
            var message = JSON.parse(localStorage.getItem(key));
            if(message) {
              _manuhFunctions._multicastMessage(topicToSubscribe, message);
            }
          }

      } else { //if the path has a wildcard that needs to be evaluated
        throw 'Wildcard paths not supported for subscriptions yet';
      }
    },

};
module.exports.manuhData = _manuhData;
module.exports.manuhFunctions = _manuhFunctions;
