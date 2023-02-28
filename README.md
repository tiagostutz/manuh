# Manuh

## DEPRECATION NOTICE

This was deprecated in favor of the standard https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel

------

A lightweight client-side topic infrastructure inspired by MQTT pub-sub interface to empower frontend event-based interactions. With `manuh` you can build one-way data flow UI without `switch-cases`, `actions`, `stores`, `reducers`, etc. In fact, `manuh` is an alternative to EventEmitter, but with the MQTT protocol steroids.

## One-way data flow

With or without `manuh` you should keep in mind the importante of one-way data flow to your applications, specially when they have views with lots of components and starts to have performance issues. Here is an example of a UI with and without `manuh`. 

Without `manuh` (and one way data flow), when the component is clicked, the `setState` of the overall view is invoked:

![Without manuh](https://res.cloudinary.com/lexana/image/upload/v1524625621/detalhamento-sem-manuh.gif)

With `manuh` (and one way data flow), the communication between the clicked component and the opening canvas component is made on a pub/sub fashion, and only the canvas component `setState` is invoked

![With manuh](https://res.cloudinary.com/lexana/image/upload/v1524625630/detalhamento-com-manuh.gif)

## Important changes

### `1.4.x` subscription override

Until now if you made a subscription to a topic with the same target (subscription identification) it would no override the previous subscription; instead it silently ignored the new subscription and kept invoking the first
callback handler for that topic/target subscription. Now when you provide another topic/target subscription, it
overrides the previous subscription callback handler with the new one

### `1.3.x` subscription now returns the retained value and the callback receives an extra `info` parameter

When you invoke the `subscription` method syncronously, it will return the retained value - if there is one.
The callback function of the `subscription` method now returns the message received and an `info`  parameter that can have some additional info of the message. The first one is an attribute indicating whether the message was a retained message or not.

### `1.2.x` wildcards and async subscription now supported! =)

You can now subscribe with `#` wildcard, just like a good ol' MQTT subscription
The `+` isn't supported yet, ¯\_(ツ)_/¯

Also, if you provide a callback `onsubscribed` in the last parameter, the subscription will be made asynchronously

### `1.0.0` interface break

Until version `1.0.0` the `subscribe` method didn't had a **target** parameter, identifying the instance that made the subscription. It was introduced in this version so the subscription can be removed by the subscriber without using any other type of ID generation method or something like this.
There's another approach to solve this problem that is returning an *subscription ID* when the subscription is made so the subscriber could unsubscribe using this ID. For the sake of simplicity, we decied to use an instance based identification, but this introduced an interface break because now the subscription has 3 parameters instead of 2.
