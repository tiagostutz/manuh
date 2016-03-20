var manuh = require('./manuh');
var assert = require('assert');

describe('manuh client-side lightweight topic infrastructure', function() {

  describe('topic creation', function() {
    describe('manuh._createTopic()', function() {
      before(function() {
        manuh.topicsTree = {}; //manual reset
      });

      it( 'should return a simple topic', function(){


        var topic = manuh._createTopic('topic_1');
        assert.equal(topic.name, 'topic_1');
        assert.equal(topic.subscriptions.length, 0);
      });
      it( 'should create a topic with parent and relate them in both topics (parent and child)', function(){
        var topic1 = manuh._createTopic('topic_1');
        var topic2 = manuh._createTopic('topic_2', topic1);
        assert(topic1.topic_2);
        assert.equal(topic1.topic_2, topic2);
        assert.equal(topic1.topic_2.name, 'topic_2');
        assert.equal(topic2.parent, topic1);
      });
    });

    describe('manuh._resolveTopicsByPath()', function() {
      before(function() {
        manuh.topicsTree = {}; //manual reset
      });

      it ('should return null', function() {
        var topics = manuh._resolveTopicsByPath('');
        assert.equal(topics, null);
      });
      it ('should return an array with 1 topic created based on a simple name (path)', function() {
        var topics = manuh._resolveTopicsByPath('simple_topic');
        assert.equal(topics.length, 1);
        assert.equal(topics[0].name, 'simple_topic');
        assert.equal(topics[0].parent, manuh.topicsTree);
      });
      it ('should return an array with 2 topics created based on a the name (charol/manuh)', function() {
        var topics = manuh._resolveTopicsByPath('charol/manuh');
        assert.equal(topics.length, 2);
        assert.equal(topics[0].name, 'charol');
        assert.equal(topics[1].name, 'manuh');

        assert.equal(topics[0].manuh, topics[1]);

        assert.equal(topics[0].parent, manuh.topicsTree);
        assert.equal(topics[1].parent, topics[0]);
      });
      it ('should return an array with 3 topics created based on a the name (charol/manuh/rhelena)', function() {
        var topics = manuh._resolveTopicsByPath('charol/manuh/rhelena');
        assert.equal(topics.length, 3);
        assert.equal(topics[0].name, 'charol');
        assert.equal(topics[1].name, 'manuh');
        assert.equal(topics[2].name, 'rhelena');

        assert.equal(topics[0].manuh, topics[1]);
        assert.equal(topics[1].rhelena, topics[2]);

        assert.equal(topics[0].parent, manuh.topicsTree);
        assert.equal(topics[1].parent, topics[0]);
        assert.equal(topics[2].parent, topics[1]);
      });
    });

  });

  describe('topic find', function() {
    describe('manuh._evaluateTopics()', function() {
      before(function() {
        manuh.topicsTree = {}; //manual reset
      });

      it('should return all the topics that matches the simple regex (charol/manuh)', function() {
        var topics = manuh._evaluateTopics('charol/manuh');
        assert.equal(topics.length, 1);

        assert.equal(topics[0].name, 'manuh');
        assert.equal(topics[0].parent.name, 'charol');
      })
    });
  });

  describe('topic publish', function() {
    describe('without subscriptions', function() {
      describe('manuh.publish()', function() {
        before(function() {
          manuh.topicsTree = {}; //manual reset
        });

        it ('should create the topics based on the path to publish passed (charol/manuh/rhelena)', function() {
          manuh.publish('charol/manuh/rhelena', '3 little girls!');

          assert(manuh.topicsTree.charol);
          assert(manuh.topicsTree.charol.manuh);
          assert(manuh.topicsTree.charol.manuh.rhelena);

          assert.equal(manuh.topicsTree.charol.name, 'charol');
          assert.equal(manuh.topicsTree.charol.manuh.name, 'manuh');
          assert.equal(manuh.topicsTree.charol.manuh.rhelena.name, 'rhelena');

          assert.equal(manuh.topicsTree.charol.parent, manuh.topicsTree);
          assert.equal(manuh.topicsTree.charol.manuh.parent, manuh.topicsTree.charol);
          assert.equal(manuh.topicsTree.charol.manuh.rhelena.parent, manuh.topicsTree.charol.manuh);

        });
      });
    });
  });

});
