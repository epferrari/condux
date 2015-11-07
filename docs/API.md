<a name="Condux"></a>
## Condux()
Builds and returns a Condux Server. A Condux Server listens to client actions via its private `CLIENT_ACTIONS`
channel. Client actions are registered using `<ConduxServer>.createAction` or `<ConduxServer>.createActions`.
Actions __must__ be symmetrically mirrored on the client using `<ConduxClient>`'s methods
`<ConduxClient>.createAction` and `<ConduxClient>.createActions`

**Kind**: global function  

* [Condux()](#Condux)
  * _instance_
    * [.attach(server, options)](#Condux+attach)
    * [.createAction(actionName, options)](#Condux+createAction)
    * [.createActions(actionNames)](#Condux+createActions)
    * [.createStore(topic, storeDefinition)](#Condux+createStore) ⇒ <code>object</code>
    * [.onNewChannel(topic)](#Condux+onNewChannel)
  * _static_
    * [.Adapter](#Condux.Adapter)


-

<a name="Condux+attach"></a>
### condux.attach(server, options)
convenience method for `<SockJS>.installHandlers(server,options)`

**Kind**: instance method of <code>[Condux](#Condux)</code>  

| Param | Type | Description |
| --- | --- | --- |
| server | <code>object</code> | http server (express, etc) |
| options | <code>object</code> | passes options as <SockJS>.installHandlers' second argument |


-

<a name="Condux+createAction"></a>
### condux.createAction(actionName, options)
wrapper for `Reflux.createAction()` that ensures actions are registered with the
Nexus instance. The `ConduxServer` instance acts as a dispatch for all client actions
registered with it.

**Kind**: instance method of <code>[Condux](#Condux)</code>  

| Param | Type | Description |
| --- | --- | --- |
| actionName | <code>string</code> |  |
| options | <code>object</code> | Reflux action options object |


-

<a name="Condux+createActions"></a>
### condux.createActions(actionNames)
wrapper for Reflux.createActions() that ensures each Action is registered on the server nexus

**Kind**: instance method of <code>[Condux](#Condux)</code>  

| Param | Type |
| --- | --- |
| actionNames | <code>array</code> | 


-

<a name="Condux+createStore"></a>
### condux.createStore(topic, storeDefinition) ⇒ <code>object</code>
wrapper for Reflux.createActions() that ensures each Action is registered on the server nexus

**Kind**: instance method of <code>[Condux](#Condux)</code>  
**Returns**: <code>object</code> - a Reflux store  

| Param | Type | Description |
| --- | --- | --- |
| topic | <code>string</code> | the name of the channel/frequency the datastore triggers to |
| storeDefinition | <code>object</code> | store methods object, like the one passed to `Reflux.createStore` |


-

<a name="Condux+onNewChannel"></a>
### condux.onNewChannel(topic)
dummy hook for when a new channel is created

**Kind**: instance method of <code>[Condux](#Condux)</code>  

| Param | Type | Description |
| --- | --- | --- |
| topic | <code>string</code> | the name of the newly created channel |


-

<a name="Condux.Adapter"></a>
### Condux.Adapter
use Adapter when your app already has a sockjs service

**Kind**: static property of <code>[Condux](#Condux)</code>  

| Param | Type | Description |
| --- | --- | --- |
| service | <code>object</code> | a SockJS server instance created elsewhere with `<SockJS>.createServer` |


-

