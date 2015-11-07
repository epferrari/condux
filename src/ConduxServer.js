var Reflux = require('reflux');
var merge = require('object-assign');
var sockjs = require('sockjs');
var Multiplexer = require('./Multiplexer.js');


/**
@private
@since 0.2.3
@desc use this instead of hauling lodash around. She's heavy
*/
function pull(arr,itm){
	var itmIdx = arr.indexOf(itm);
	arr.splice(itmIdx,1);
	return (arr.indexOf(itm) !== -1) ? pull(arr,itm) : arr;
};

/**
@private
@since 0.2.3
@desc use this instead of hauling lodash around. She's heavy
*/
function isFn(fn){
	return ({}).toString.call(fn).match(/\s([a-zA-Z]+)/)[1].toLowerCase() === "function";
}




var channelRegistered = Reflux.createAction();
// dummy proto methods for DataStores
Reflux.StoreMethods.hydrate = function(){ return {}; };
Reflux.StoreMethods.handleRequest = function(constraints){ return {}; };


/**
* A singleton multiplexing websocket service for Reflux using sockjs.
* Builds a `CLIENT_ACTION` channel that listens for any client actions registered
* on the server using `<ConduxServer>.createAction(<action>)` or `<ConduxServer>.createActions(<actions>)`.
* Actions __must__ be symmetrically mirrored on the client using the static methods
* `<ConduxClient>.createAction` and `<ConduxClient>.createActions`
*
* @param {obj} service - sockjs service
* @private
*/

function ConduxServer(service) {
	this.registered_actions = {};
	this.service = service;

	var multiplexer = new Multiplexer(this.service);

	this.registerChannel = function(topic){
		let channels = multiplexer.registered_channels;
		if(!channels[topic]){
			multiplexer.registerChannel(topic);
			// call action to
			channelRegistered(topic);
			this.onNewChannel(topic);
		}
		return channels[topic];
	};

	// create store to notify clients when a channel is created,
	// in case they have subscribed to a channel that's not available yet
	var _register = this.createStore("/REGISTRATIONS",{
		init(){
			this.listenTo(channelRegistered,this.onChannelRegistered);
		},
		hydrate(){
			return {registeredChannels: Object.keys(multiplexer.registered_channels)};
		},
		handleRequest(){
			return {registeredChannels: Object.keys(multiplexer.registered_channels)};
		},
		onChannelRegistered(channelName){
			this.trigger({registered: channelName});
		}
	});

	// create a channel to handle all client actions created by `<ConduxClient>.createAction()`
	var _clientActions = multiplexer.registerChannel('/CLIENT_ACTIONS');

	_clientActions.on('connection',(conn) => {
		conn.on('data',(data) => {
			var action;
			var actionType = data.actionType;
			// set off Reflux action on any matching action from the client
			if(action = this.registered_actions[actionType]) action(data.payload);
		});
	});
}

ConduxServer.prototype = {


	/**
	* @desc convenience method for `<SockJS>.installHandlers(server,options)`
	* @instance
	* @memberof Condux
	* @param {object} server - http server (express, etc)
	* @param {object} options - passes options as <SockJS>.installHandlers' second argument
	*/
	attach(server,options) {
		this.service.installHandlers(server,options);
	},

	/**
	* @desc wrapper for `Reflux.createAction()` that ensures actions are registered with the
	* Nexus instance. The `ConduxServer` instance acts as a dispatch for all client actions
	* registered with it.
	*
	* @instance
	* @memberof Condux
	* @param {string} actionName
	* @param {object} options - Reflux action options object
	*/
	createAction(actionName, options) {
		var action = Reflux.createAction(options);
		this.registered_actions[actionName] = action;
		return action;
	},

	/**
	* @instance
	* @memberof Condux
	* @desc wrapper for Reflux.createActions() that ensures each Action is registered on the server nexus
	* @param {array} actionNames
	*/
	createActions(actionNames) {
		return actionNames.reduce((accum, actionName) => {
			accum[actionName] = this.createAction(actionName);
			return accum;
		},{});
	},

	/**
	* @instance
	* @memberof Condux
	* @desc wrapper for Reflux.createActions() that ensures each Action is registered on the server nexus
	* @param {string} topic - the name of the channel/frequency the datastore triggers to
	* @param {object} storeDefinition - store methods object, like the one passed to `Reflux.createStore`
	* @returns {object} a Reflux store
	*/
	createStore(topic,storeDefinition) {

		var connections,channel,store,_emit;

		store = Reflux.createStore(storeDefinition);

		connections = [];
		channel = this.registerChannel(topic);
		channel.on('connection', (conn) => {

			// add connection to connection collection
			connections.push(conn);

			// hydrate the client with an initial dataset, if `<store>._hydrate` is defined
			var hydration = store.hydrate();
			conn.conn.write([ 'conn',topic,JSON.stringify(hydration) ].join(","));

			// handle individual client requests to the Datastore, like for a data refresh
			conn.on('request', request => {
				let response = {request_token: request.request_token};

				// duck-type to see if handleRequest returned a promise
				var maybePromise = store.handleRequest(request.constraints);
				if(isFn(maybePromise) && maybePromise.then && maybePromise.then.call && maybePromise.then.apply){
					maybePromise.then(
						result => {
							response.body = result;
							conn.conn.write(['res',topic,JSON.stringify(response)].join(','));
						},
						error => {
							response.error = error,
							conn.conn.write(['err',topic,JSON.stringify(response)].join(','));
						});
				}else{
					response.body = maybePromise;
					conn.conn.write(['res',topic,JSON.stringify(response)].join(','));
				}
			});

			// cleanup store listener on close of connection
			conn.on('close', () => pull(connections, conn) );
		});

		// cache original emit method
		_emit = store.emitter.emit;

		// overwrite the Reflux Store's emitter to send messages to client on `trigger`
		store.emitter.emit = (eventLabel,args) => {
			Promise.all(connections.map(function (conn) {
				return new Promise(function(resolve) {
					// notify clients on trigger
					conn.write(JSON.stringify(args[0]));
					resolve();
				});
			}));
			// notify local Reflux Stores on the server
			_emit.call(store.emitter,eventLabel,args);
		};

		return store;
	},


	/**
	* @instance
	* @memberof Condux
	* @desc dummy hook for when a new channel is created
	* @param {string} topic - the name of the newly created channel
	*/
	onNewChannel(topic){
		return;
	},
};





/**
* An over-the-wire unidirectional data-flow architecture utilizing Reflux as the flux pattern implementation and SockJS as the websocket implementation.
* In conjunction with [condux-client](https:github.com/epferrari/condux-client), a Condux nexus listens to client actions via its private `CLIENT_ACTIONS`
* channel. Client actions are registered using `<ConduxServer>.createAction` or `<ConduxServer>.createActions`.
* Actions __must__ be symmetrically mirrored on the client using `<ConduxClient>`'s methods
* `<ConduxClient>.createAction` and `<ConduxClient>.createActions`
* @name Condux
* @kind function
*/
function Condux(options) {
	options = merge({},{sockjs_url: 'http://cdn.jsdelivr.net/sockjs/0.3.4/sockjs.min.js',prefix: "/condux"},options);
	var service = sockjs.createServer(options);
	return new ConduxServer(service);
}


/**
* use Adapter when your app already has a sockjs service
* @name Adapter
* @memberof Condux
* @param {object} service - a SockJS server instance created elsewhere with `<SockJS>.createServer`
*/
Condux.Adapter = function Adapter(service) {
	return new ConduxServer(service);
};



export default Condux;
