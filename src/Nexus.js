var Reflux = require('reflux');
var {pull,merge} = require('lodash');
var sockjs = require('sockjs');
//var Multiplexer = require('websocket-multiplex');
var Multiplexer = require('./Multiplexer.js');




var channelRegistered = Reflux.createAction();
// dummy proto methods for DataStores
Reflux.StoreMethods.hydrate = function(){ return {}; };
Reflux.StoreMethods.handleRequest = function(constraints){ return {}; };


/**
* A singleton multiplexing websocket service for Reflux using sockjs
* builds a `CLIENT_ACTION` channel that listens for any client actions registered
* on the server using `<ServerNexus>.createAction(<action>)` or `<ServerNexus>.createActions(<actions>)`.
* Actions __must__ be symmetrically mirrored on the client using the static methods
* `<ClientNexus>.createAction` and `<ClientNexus>.createActions`
*
* @param {obj} service - sockjs service
*/

function _ServerNexus(service) {
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

	// create a channel to handle all client actions created by `ClientNexusInstance.createAction()`
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

_ServerNexus.prototype = {

	// dummy
	onNewChannel(topic){
		return;
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
	* wrapper for Reflux.createActions() that ensures each Action is registered on the server nexus
	* @param {array} actionNames
	*/
	createActions(actionNames) {
		return actionNames.reduce((accum, actionName) => {
			accum[actionName] = this.createAction(actionName);
			return accum;
		},{});
	},

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
				let response = {
					request_token: request.request_token,
					body: store.handleRequest(request.constraints)
				};
				conn.conn.write([ 'res',topic,JSON.stringify(response) ].join(','));
			});

			// cleanup store listener on close of connection
			conn.on( 'close', () => pull(connections, conn) );
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
			// notify other Reflux Stores on the server
			_emit.call(store.emitter,eventLabel,args);
		};

		return store;
	},

	/**
	* @desc convenience method for `this.service.installHandlers(server,options)`
	*/
	attach(server,options) {
		this.service.installHandlers(server,options);
	}
};





/**
* wrapper that will create a new Nexus with a new sockjs service and a new multiplexer
*/
function Nexus(options) {
	options = merge({},{sockjs_url: 'http://cdn.jsdelivr.net/sockjs/0.3.4/sockjs.min.js',prefix: "/reflux-nexus"},options);
	var service = sockjs.createServer(options);
	return new _ServerNexus(service);
}


/**
* use Adapter when your app already has a sockjs service
*/
Nexus.Adapter = function Adapter(service) {
	return new _ServerNexus(service);
};



export default Nexus;
