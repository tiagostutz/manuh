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
            subscriptions.push({onMessageReceived : onMessageReceived});
          }
        }
        if (_parent) {
          _parent[_name] = topic;
        }

        return topic;
    },

    //returns an array with all matched topics
    _resolveTopicsByPath : function(topicPath, topicNode) {
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
        var topics = this._resolveTopicsByPath(topicPath.substring(idxHash+1), topicNode[firstLevelName]);
        arrTopics = arrTopics.concat(topics);
      }

      return arrTopics;
    },

    _evaluateTopics : function(topicPath) {

      var arrMatchedTopics = [];
      if (!this._hasSpecialWildcard(topicPath)) {
        var arrTopics = this._resolveTopicsByPath(topicPath);
        arrMatchedTopics.push(arrTopics[arrTopics.length-1]); //return the last topic found, that will be the last one on the path
        return arrMatchedTopics;
      }else{

        var idxHash = topicPath.indexOf("/");

        var firstLevelName = topicPath;
        if (idxHash != -1) {
          firstLevelName = topicPath.substring(0, topicPath.indexOf("/"));
        }
      }
      },



    publish: function(topicPath, message) {
      var topicToPublish = null;

      if (!this._hasSpecialWildcard(topicPath)) {
        topicToPublish = this._resolveTopicsByPath(topicPath);

      }else{ //if the path has a wildcard that needs to be evaluated

        throw {msg: 'Erro ao publicar no topico'};
      }

      for(var k=0; k<topicToPublish.subscriptions; k++) {

        //invoke the callbacks asynchronously and with a closed scope
        var subscription = topicToPublish[i].subscriptions[k];
        (function(subsc) {
          var _subsc = subsc;
          setTimeout(function() {
            _subsc.onMessageReceived(message);
          }, 0);
        })(subscription);
      }

    },

    subscribe: function(topicNameRegex) {

    }

}
