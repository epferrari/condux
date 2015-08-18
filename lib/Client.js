'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _reflux = require('reflux');

var _reflux2 = _interopRequireDefault(_reflux);

var _sockjsClient = require('sockjs-client');

var _sockjsClient2 = _interopRequireDefault(_sockjsClient);

var _WebSocketMultiplexJs = require('./WebSocketMultiplex.js');

var _WebSocketMultiplexJs2 = _interopRequireDefault(_WebSocketMultiplexJs);

var uniqId = function uniqId() {
	return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1).toUpperCase();
};

var ClientNexus = {};
var sock, mplex, actionChannel;

ClientNexus.initialize = function (prefix) {
	sock = new _sockjsClient2['default'](prefix || '/reflux-nexus');
	mplex = new _WebSocketMultiplexJs2['default'](sock);
	actionChannel = mplex.channel('NEXUS_CLIENT_ACTIONS');
};

// returns a function that sends the ServerNexus a keyed object with actionType and payload
ClientNexus.createAction = function (actionName) {
	return function (payload) {
		return actionChannel.send(JSON.stringify({
			actionType: actionName,
			payload: payload
		}));
	};
};

// return a hash of action name keys with ClientNexus actions as values
ClientNexus.createActions = function (actionNames) {
	var _this = this;

	return actionNames.reduce(function (accum, actionName) {
		accum[actionName] = _this.createAction(actionName);
		return accum;
	}, {});
};

function Channel(name) {
	var _this2 = this;

	this.channelName = name;
	this.sock = mplex.channel(name);
	this.subscribers = {};
	this.sock.onmessage = function (msg) {
		Promise.all(_this2.subscribers.reduce(function (accum, sub) {
			accum.push(new Promise(function (resolve, reject) {
				sub.handler.apply(sub.listener, [JSON.parse(msg.data)]);
				resolve();
			}));
			return accum;
		}, []));
	};

	this.sock.onclose = function () {};
};

Channel.prototype.addListener = function (subscriber) {
	var token = uniqId();
	this.subscribers[token] = subscriber;
	return token;
};

Channel.prototype.removeListener = function (token) {
	this.subscribers[token] = null;
};

ClientNexus.Channel = Channel;

function listenToChannel(channel, handler) {
	var addListener = channel.addListener;
	var removeListener = channel.removeListener;
	var channelName = channel.channelName;

	if (!(nexus instanceof Channel)) {
		return new Error('First argument passed to .tuneIn must a Client Nexus Channel.');
	}

	if (!this.subscriptions[channelName]) {
		var token = addListener({
			handler: handler,
			listener: this
		});
		this._nexusTokens.push(removeListener.bind(channel, token));
	}
}

/**
* Mixin for React Component
*/
ClientNexus.Connect = {

	componentWillMount: function componentWillMount() {
		this.tokens = {};
		this._nexusTokens = [];
		this.tuneIn = listenToChannel.bind(this);
	},

	componentWillUnmount: function componentWillUnmount() {
		this._nexusTokens.forEach(function (disposer) {
			return disposer();
		});
	}
};

exports['default'] = ClientNexus;

/**
* ClientNexus.initialize(prefix)
* ClientNexus.createAction(action)
* ClientNexus.createActions(actions)
*
* ClientNexus.Channel(name)
*		Channel.addListener(subscriber)
*		Channel.removeListener(token)
*
* ClientNexus.Connect
*/
module.exports = exports['default'];