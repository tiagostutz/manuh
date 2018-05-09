# manuh
A lightweight client-side topic infrastructure inspired by MQTT pub-sub interface to empower frontend event-based interactions

# Important changes

## `1.0.0` interface break
Until version `1.0.0` the `subscribe` method didn't had a **target** parameter, identifying the instance that made the subscription. It was introduced in this version so the subscription can be removed by the subscriber without using any other type of ID generation method or something like this.
There's another approach to solve this problem that is returning an *subscription ID* when the subscription is made so the subscriber could unsubscribe using this ID. For the sake of simplicity, we decied to use an instance based identification, but this introduced an interface break because now the subscription has 3 parameters instead of 2.


## `1.1.0` wildcards now supported! =)
You can now subscribe with `#` wildcard, just like a good ol' MQTT subscription
The `+` isn't supported yet, ¯\_(ツ)_/¯