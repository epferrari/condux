'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});
var Reflux = require('reflux');

var _require = require('lodash');

var isFunction = _require.isFunction;
var pull = _require.pull;

var sockjs = require('sockjs');
var webSocketMplex = require('websocket-multiplex');

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
	var _this = this;

	this._registeredActions = {};
	this.service = service;
	this.multiplexer = multiplexer || new webSocketMplex.MultiplexServer(this.service);
	this.CLIENT_ACTION_CHANNEL = this.multiplexer.registerChannel('NEXUS_CLIENT_ACTIONS');
	this.CLIENT_ACTION_CHANNEL.on('connection', function (conn) {
		conn.on('data', function (data) {
			data = JSON.parse(data);
			var action = undefined;
			// set off Reflux action on any matching action from the client
			if (action = _this._registeredActions[data.actionType]) action(data.payload);
		});
	});
}

_ServerNexus.prototype = {
	/**
 * wrapper for Reflux.createAction() that ensures actions are registered with the
 * Nexus instance. Each ServerNexus instance acts as a Dispatch for all client actions
 * registered with it.
 *
 * @param {string} actionName
 * @param {object} options - Reflux action options object
 */
	createAction: function createAction(actionName, options) {
		var action = Reflux.createAction(options);
		this._registeredActions[actionName] = action;
		return action;
	},

	/**
 * wrapper for Reflux.createActions() that ensures each Action has a `nxs_id` property
 * @param {array} actionNames
 */
	createActions: function createActions(actionNames) {
		var _this2 = this;

		return actionNames.reduce(function (accum, actionName) {
			accum[actionName] = _ServerNexus.prototype.createAction.apply(_this2, actionName);
			return accum;
		}, {});
	},

	Cell: function Cell(channel, storeDefinition) {
		var cell = {};
		var store = cell.store = Reflux.createStore(storeDefinition);
		isFunction(store.hydrate) || (store.hydrate = function () {
			return {};
		});

		cell.connections = [];
		cell.channel = this.multiplexer.registerChannel(channel);
		cell.channel.on('connection', function (conn) {
			// hydrate the client with an initial dataset, if `hydrate` is defined
			conn.write(JSON.stringify(store.hydrate()));
			// add connection to connection collection
			cell.connections.push(conn);
			// cleanup store listener on close of connection
			conn.on('close', function () {
				pull(cell.connections, conn);
			});
		});

		// cache original emit method
		var _emit = store.emitter.emit;

		// overwrite the Reflux Store's emitter to send messages to client on `trigger`
		store.emitter.emit = function (event, outbound) {
			Promise.all(cell.connections.map(function (c) {
				return new Promise(function (resolve) {
					// notify clients on trigger
					if (event === store.eventLabel) {
						c.write(JSON.stringify(outbound[0]));
					}
					// notify other Reflux Stores on the server
					_emit.apply(store.emitter, [].concat('change', outbound));
					resolve();
				});
			}));
		};

		return cell;
	},

	attach: function attach(server, prefix) {
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

exports['default'] = ServerNexus;
module.exports = exports['default'];