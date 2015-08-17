var Reflux = require('reflux');
var _ = require('lodash');
var sockjs = require('sockjs');
var webSocketMplex = require('websocket-multiplex');


/**
* A singleton multiplexing websocket service for Reflux using sockjs
* builds a `CLIENT_ACTION_CHANNEL` that listens for any client actions registered
* on the server using `[Nexus instance].action` or `[Nexus instance].actions`.
* Actions must be symmetrically mirrored on the client using the static methods
* `ClientNexus.action` and `ClientNexus.actions`
*
* @param service {obj} sockjs service
* @param multiplexer {obj} websocket-multiplexer
*/

var _Nexus = function _Nexus(service,multiplexer){
	this._registeredActions = {};
	this.service = service;
	this.multiplexer = multiplexer || new webSocketMplex.MultiplexServer(this.service);
	this.CLIENT_ACTION_CHANNEL = this.multiplexer.registerChannel('CLIENT_ACTIONS');
	this.CLIENT_ACTION_CHANNEL.on('connection',function(conn){
		conn.on('data',function(data){
			data = JSON.parse(data);
			var action = this._registeredActions[data.action];
			// set off Reflux action on any matching action from the client
			if(action){
				action(data.payload);
			}
		}.bind(this));
	}.bind(this));
};

/**
* wrapper for Reflux.createAction() that ensures actions are registered with the
* Nexus instance. Each Nexus instance acts as a Dispatch for all client actions
* registered with it.
*
* @param name {string}
* @param options {object} Reflux action options object
*/
_Nexus.prototype.serverAction = function(name,options){
	var action = Reflux.createAction(options);
	this._registeredActions[name] = action;
	return action;
};

/**
* wrapper for Reflux.createActions() that ensures each Action has a `nxs_id` property
* @param arr {array} action names
*/
_Nexus.prototype.serverActions = function(arr){
	return arr.reduce(function(res,name){
		res[name] = this.serverAction(name);
		return res;
	}.bind(this),{});
};


_Nexus.prototype.Cell = function Cell(channel,storeDefinition){
	var cell = {};
	var store = cell.store = Reflux.createStore(storeDefinition);
	_.isFunction(store.hydrate) || (store.hydrate = function(){return {}; });

	cell.connections = [];
	cell.channel = this.multiplexer.registerChannel(channel);
	cell.channel.on('connection',function(conn){
		// hydrate the client with an initial dataset, if `hydrate` is defined
		conn.write(JSON.stringify(store.hydrate()));
		// add connection to connection collection
		cell.connections.push(conn);
		// cleanup store listener on close of connection
		conn.on('close',function(){
			_.pull(cell.connections,conn);
		});
	});

	// cache original emit method
	var _emit = store.emitter.emit;

	// overwrite the Reflux Store's emitter to send messages to client on `trigger`
	store.emitter.emit = function(event,outbound){
		Promise.all(cell.connections.map(function(c){
			return new Promise(function(resolve){
				// notify clients on trigger
				if(event === store.eventLabel){
					c.write(JSON.stringify(outbound[0]));
				}
				// notify other Reflux Stores on the server
				_emit.apply(store.emitter,[].concat('change',outbound));
				resolve();
			});
		}));
	};

	return cell;
};

_Nexus.prototype.attach = function(server,prefix){
	this.service.installHandlers(server,{prefix: prefix || '/reflux-nexus' });
};


/**
* wrapper that creates a new Nexus with a new sockjs service and a new multiplexer
*/
var Nexus = function Nexus(){
	var service = sockjs.createServer();
	return new _Nexus(service);
};

/**
* use Adapter when your app already has a sockjs service
*	and possibly an existing multiplex instance
*/
Nexus.Adapter = function Adapter(service,multiplexer){
	return new _Nexus(service,multiplexer);
};


module.exports = Nexus;
