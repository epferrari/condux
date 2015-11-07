/* inspired and adapted from https://github.com/sockjs/websocket-multiplex */

'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _ChannelJs = require('./Channel.js');

var _ChannelJs2 = _interopRequireDefault(_ChannelJs);

var _events = require('events');

function Multiplexer(service) {
	var _this = this;

	this.registered_channels = {};
	this.service = service;
	this.service.on('connection', function (conn) {
		// hash of channels for the client connection
		var channels = {};

		conn.on('data', function (message) {
			var t = message.split(','),
			    type = t.shift(),
			    topic = t.shift(),
			    payload = t.join();

			// the channel has not been created by the Multiplexer
			if (!_this.registered_channels[topic]) {
				// let the subscriber client know there is no channel available and return early
				if (type === "sub") conn.write("rej," + topic);
				return;
			}

			// the client connection is already subscribed to the channel
			if (channels[topic]) {
				var sub = channels[topic];

				switch (type) {
					case 'uns':
						// unsubscrible the client from the channel
						delete channels[topic];
						sub.emit('close');
						break;
					case 'msg':
						sub.emit('data', JSON.parse(payload));
						break;
					case 'req':
						sub.emit('request', JSON.parse(payload));
						break;
				}
			} else if (type === "sub") {
				var sub = channels[topic] = new _ChannelJs2['default'](conn, topic, channels);
				_this.registered_channels[topic].emit('connection', sub);
			}
		});

		// close the client connection destroy all subscribers
		conn.on('close', function () {
			var topics = Object.keys(channels);
			topics.forEach(function (topic) {
				return channels[topic].emit('close');
			});
			channels = {};
		});
	});
};

Multiplexer.prototype.registerChannel = function (name) {
	return this.registered_channels[escape(name)] = new _events.EventEmitter();
};

exports['default'] = Multiplexer;
module.exports = exports['default'];