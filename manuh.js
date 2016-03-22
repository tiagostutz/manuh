// Following MQTT wildcard spec
//http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718107

module.exports = {
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

    _hasSpecialWildcard : function(str) {
        return str.indexOf(this.multiLevelWildCard)!=-1
        || str.indexOf(this.singleLevelWildCard)!=-1
    },

    _createTopic: function(_name, _parent) {
        var topic = {
          name : _name,
          parent : _parent,
          subscriptions : [],
          addSubscription: function(onMessageReceived) {
              this.subscriptions.push({onMessageReceived : onMessageReceived});
          }
        }
        if (_parent) {
            _parent[_name] = topic;
        }

        return topic;
    },

    //returns an array with all matched topics
    _resolveTopicsByPathRegex : function(topicPath, topicNode) {
      var arrTopics = [];
      if (topicNode == null) {
          var topicNode = this.topicsTree;
      }
      var idxHash = topicPath.indexOf("/");

      var firstLevelName = topicPath;
      if (idxHash!=-1) {
          var firstLevelName = topicPath.substring(0, topicPath.indexOf("/"));
      }
      if (firstLevelName.trim().length == 0) {
          return null;
      }

      if (!topicNode.hasOwnProperty(firstLevelName)) {
          topicNode[firstLevelName] = this._createTopic(firstLevelName, topicNode);
      }

      arrTopics.push(topicNode[firstLevelName]);
      if (idxHash!=-1) {
          var topics = this._resolveTopicsByPathRegex(topicPath.substring(idxHash+1), topicNode[firstLevelName]);
          arrTopics = arrTopics.concat(topics);
      }

      return arrTopics;
    },

    _resolveTopic : function(topicPath) {
      if (!this._hasSpecialWildcard(topicPath)) {
          var arrTopics = this._resolveTopicsByPathRegex(topicPath);
          return arrTopics[arrTopics.length-1]; //return only the last topic found, that will be the last one on the path
      }else{
          throw {msg: 'Error to resolve a topic by the path provided because it has a wildcard and hence could find 2 or more topcis. This method is intended to be used to get only one topic. To resolve path using wildcards use `_resolveTopicsByPathRegex`.'};
      }
    },



    publish: function(topicPath, message) {
        var topicToPublish = null;

        if (!this._hasSpecialWildcard(topicPath)) {
            var topicToPublish = this._resolveTopic(topicPath);

        }else{ //if the path has a wildcard that needs to be evaluated
            throw {msg: 'Error to publish message on topic because the topic name (path) provided has invalid characters. Note: you cannot publish using wildcards like you can use on subscriptions.'};
        }
        if (topicToPublish.length > 1) {
            throw {msg: 'Error to publish message on topic because there were found more than 1 topic for the provied topicPath. You can publish only to one topic. Check if there are duplicated topic names.'};
        }

        for(var k=0; k<topicToPublish.subscriptions.length; k++) {
            //invoke the callbacks asynchronously and with a closed scope
            var subscription = topicToPublish.subscriptions[k];
            _self = this;
            (function(subsc) {
              var _subsc = subsc;
              setTimeout(function() {
                _subsc.onMessageReceived(message);
            }, _self.__publishCallbackInvokeIntervalDelay);
            })(subscription);
        }

    },

    subscribe: function(topicPathRegex, onMessageReceived) {
      if (!onMessageReceived) {
          throw {msg: 'Error subscribing to `' + topicPathRegex + '` because no `onMessageReceived` callback function was provided.'};
      }

      var topicToSubscribe = null;

      if (!this._hasSpecialWildcard(topicPathRegex)) {
          topicToSubscribe = this._resolveTopic(topicPathRegex);
          topicToSubscribe.addSubscription(onMessageReceived);//if there aren't wildcards on the topicPath, them it will be a subscription for only one topic
      }else{ //if the path has a wildcard that needs to be evaluated

      }
    }

}
