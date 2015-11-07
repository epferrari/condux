<a name="Condux"></a>
## Condux
A singleton multiplexing websocket service for Reflux using sockjs.
Builds a `CLIENT_ACTION` channel that listens for any client actions registered
on the server using `<ConduxServer>.createAction(<action>)` or `<ConduxServer>.createActions(<actions>)`.
Actions __must__ be symmetrically mirrored on the client using the static methods
`<ConduxClient>.createAction` and `<ConduxClient>.createActions`

**Kind**: global variable  

* [Condux](#Condux)
  * _instance_
    * [.onNewChannel](#Condux+onNewChannel)
    * [.createAction](#Condux+createAction)
    * [.createActions](#Condux+createActions)
    * [.createStore](#Condux+createStore)
    * [.attach()](#Condux+attach)
  * _static_
    * [.Adapter](#Condux.Adapter)


-

<a name="Condux+onNewChannel"></a>
### condux.onNewChannel
dummy hook for when a new channel is created

**Kind**: instance property of <code>[Condux](#Condux)</code>  

| Param | Type | Description |
| --- | --- | --- |
| topic | <code>string</code> | the name of the newly created channel |


-

<a name="Condux+createAction"></a>
### condux.createAction
wrapper for `Reflux.createAction()` that ensures actions are registered with the
Nexus instance. The `ConduxServer` instance acts as a dispatch for all client actions
registered with it.

**Kind**: instance property of <code>[Condux](#Condux)</code>  

| Param | Type | Description |
| --- | --- | --- |
| actionName | <code>string</code> |  |
| options | <code>object</code> | Reflux action options object |


-

<a name="Condux+createActions"></a>
### condux.createActions
wrapper for Reflux.createActions() that ensures each Action is registered on the server nexus

**Kind**: instance property of <code>[Condux](#Condux)</code>  

| Param | Type |
| --- | --- |
| actionNames | <code>array</code> | 


-

<a name="Condux+createStore"></a>
### condux.createStore
wrapper for Reflux.createActions() that ensures each Action is registered on the server nexus

**Kind**: instance property of <code>[Condux](#Condux)</code>  

| Param | Type | Description |
| --- | --- | --- |
| topic | <code>string</code> | the name of the channel/frequency the datastore triggers to |
| storeDefinition | <code>object</code> | store methods object, like the one passed to `Reflux.createStore` |


-

<a name="Condux+attach"></a>
### condux.attach()
convenience method for `<SockJS>.installHandlers(server,options)`

**Kind**: instance method of <code>[Condux](#Condux)</code>  

-

<a name="Condux.Adapter"></a>
### Condux.Adapter
use Adapter when your app already has a sockjs service

**Kind**: static property of <code>[Condux](#Condux)</code>  

-

