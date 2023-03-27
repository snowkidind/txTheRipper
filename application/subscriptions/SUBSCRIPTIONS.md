# Subscriptions

Subscribe to get notifications from incoming transactions on an service by service basis. The application provides delivery methods via unix socket and redis pub/sub. 

# Services

## Accounts

The accounts module allows you to set a subscription to listen for any transaction where account is in the transactions topics. (Topics are all addresses derived from the transaction) To enable this feature, set `SUB_TYPE_ACCOUNT=true` in your .env

## contract creation events by type e.g. all, erc20, nft (inProgress)

Contract creation events are currently under development

## events emitted on a specific contract address (Transfer, Rugpull, etc) (inProgress)

Event emission events are currently under development

## function call on a specific contract address (inProgress)

Function call events are currently under development

## value > x (eth only) on a specific address and value > x ercTx on a specific address (inProgress)

Value > transaction events are currently under development

# Message Delivery

You can choose to have the indexer deliver the transaction information via a unix socket or inject it directly into redis. Subscriptions are managed in txTheRipper's pg database.

To globally disable all subscription methods set `SUB_SUSPEND_ALL=false` in order to preserve system resources for other tasks.

# Deliver Notifications via a unix socket interface

Notifications related to subscriptions with the `unix_socket` deliveryMethod are routed to the unix socket when the criteria is matched.

To enable unix socket based subscriptions you must specify the `SUB_USE_UNIX_SOCKET=true` key in .env as well as any particular services to enable such as `SUB_TYPE_ACCOUNT=true` Be sure to specify the same socket your listener will connect to via `SUB_UNIX_SOCKET=/path/to/ripper.sock` With unix sockets, since the socket takes into account who is listening, only notifications related to currently connected listeners will be delivered via the interface. A setListener message must be sent to register your listener via the unix socket. This does not persist over server restarts, and your socket will be disconnected in that case.

See /application/subscriptions/examples for implementation details.

# Deliver Notifications via the redis interface

In order to deliver notifications to another script via redis, redis provides a  Pub/Sub interface that conveniently suffices for anonymous publishers and subscribers: see also https://redis.io/docs/manual/pubsub/
  
Subscriptions with the `redis_mem` deliveryMethod are routed to redis when the criteria is matched.

Since the redis implementation is anonymous, any connection can listen for any event if a subscription exists for it. For instance if an application is tracking an EOA, another application may also listen to the subscription. The unix socket provides a more private variation where each listener is required to subscribe before receiving their own notifications.

Also, to enable redis based subscriptions you must specify the `SUB_USE_REDIS=true` key in .env as well as any particular services to enable such as `SUB_TYPE_ACCOUNT=true`

use the clientConfig cli to initialize subscriptions and interact with enabling and disabling subscriptions

# The subscriptions cli

In the application cli, there is a menu which will help you get started with, and manage subscriptions

A profile allows you to create subscriptions to events triggered via the indexer. To use the config tool, first, you must either select or create a profile to attach subscriptions to.

Therein you can interact with the cli as follows:

  ```
  n    Create new profile
  ```

Creates a new profile. The profile allows you to have larger scale control over the current subscriptions. A profile contains an id, a global enabled status(unimplemented), and an identifier. 

  ```
  p    show profile
  ```
  Display the profile details from the selected profile.
  
  ```
  s    Get Subscriptions
  ```
Display subscriptions for the selected profile. 

  ```
  +    Add Subscription
  ```
Add a subscription to the selected profile

  ```
  -    Remove Subscription
  ```
Remove a subscription from the selected profile

  ```
  d    Disable Subscription
  ```
Disable a subscription from the selected profile. This has the effect of stopping the broadcasting of events at the indexer level.

  ```
  e    Enable Subscription
  ```

Enable a subscription from the selected profile. This has the effect of starting the broadcasting of events at the indexer level. Subscriptions are enabled by default.

