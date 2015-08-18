var Reflux = require('reflux');
var {isFunction,pull} = require('lodash');
var sockjs = require('sockjs');
var Multiplexer = require('websocket-multiplex');


/**
* A singleton multiplexing websocket service for Reflux using sockjs
* builds a `CLIENT_ACTION_CHANNEL` channel that listens for any client actions registered
* on the server using `<ServerNexus>.createAction(<action>)` or `<ServerNexus>.createActions(<actions>)`.
* Actions __must__ be symmetrically mirrored on the client using the static methods
* `ClientNexus.createAction` and `ClientNexus.createActions`
*
* @param {obj} service - sockjs service
* @param {obj} multiplexer - websocket-multiplexer
*/

function _ServerNexus(service, multiplexer) {
	this.registered_actions = {};
	this.service = service;
	this.multiplexer = multiplexer || new Multiplexer.MultiplexServer(this.service);
	this.CLIENT_ACTION_CHANNEL = this.multiplexer.registerChannel('CLIENT_NEXUS_ACTIONS');
	this.CLIENT_ACTION_CHANNEL.on('connection',(conn) => {
		conn.on('data',(data) => {
			data = JSON.parse(data);
			var action;
			var actionType = data.actionType;
			if(actionType === "REGISTER_CLIENT_CHANNEL") this.registerChannel(data.payload.topic);
			// set off Reflux action on any matching action from the client
			else if (action = this.registered_actions[actionType]) action(data.payload);
		});
	});
}

_ServerNexus.prototype = {

	// dummy
	onNewChannel(topic){
		return;
	},

	registerChannel(topic){
		let channels = this.multiplexer.registered_channels;
		if(!channels[topic]){
			this.multiplexer.registerChannel(topic);
			this.onNewChannel(topic);
		}
		return channels[topic];
	},

	/**
	* wrapper for Reflux.createAction() that ensures actions are registered with the
	* Nexus instance. Each ServerNexus instance acts as a Dispatch for all client actions
	* registered with it.
	*
	* @param {string} actionName
	* @param {object} options - Reflux action options object
	*/
	createAction(actionName, options) {
		var action = Reflux.createAction(options);
		this.registered_actions[actionName] = action;
		return action;
	},

	/**
	* wrapper for Reflux.createActions() that ensures each Action has a `nxs_id` property
	* @param {array} actionNames
	*/
	createActions(actionNames) {
		return actionNames.reduce((accum, actionName) => {
			accum[actionName] = this.createAction(actionName);
			return accum;
		},{});
	},

	cell(topic,storeDefinition) {

		var connections,channel,store,_emit;

		store = Reflux.createStore(storeDefinition);
		isFunction(store.bootstrap) || (store.bootstrap = function() {
			return {};
		});

		connections = [];
		channel = Nexus.registerChannel(topic);
		channel.on('connection', (conn) => {
			// hydrate the client with an initial dataset, if `hydrate` is defined
			conn.write(JSON.stringify(store.bootstrap()));
			// add connection to connection collection
			connections.push(conn);
			// cleanup store listener on close of connection
			conn.on( 'close', () => pull(connections, conn) );
		});

		// cache original emit method
		_emit = store.emitter.emit;

		// overwrite the Reflux Store's emitter to send messages to client on `trigger`
		store.emitter.emit = (eventLabel, outbound) => {
			Promise.all(connections.map(function (conn) {
				return new Promise(function(resolve) {
					// notify clients on trigger
					conn.write(JSON.stringify(outbound[0]));
					// notify other Reflux Stores on the server
					_emit.apply(store.emitter, [].concat(eventLabel,outbound));
					resolve();
				});
			}));
		};

		return store;
	},

	attach(server, prefix) {
		this.service.installHandlers(server, { prefix: prefix || '/reflux-nexus' });
	}
};

/**
* wrapper that creates a new Nexus with a new sockjs service and a new multiplexer
*/
function ServerNexus() {
	var service = sockjs.createServer();
	return new _ServerNexus(service);
}

/**
* use Adapter when your app already has a sockjs service
*	and possibly an existing multiplex instance
*/
ServerNexus.Adapter = function Adapter(service, multiplexer) {
	return new _ServerNexus(service, multiplexer);
};

export default ServerNexus;