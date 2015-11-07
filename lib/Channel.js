/* ported from https://github.com/sockjs/websocket-multiplex */

'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

var _stream = require('stream');

var Channel = function Channel(conn, topic, channels) {
	this.conn = conn;
	this.topic = topic;
	this.channels = channels;
	_stream.Stream.call(this);
};

Channel.prototype = new _stream.Stream();
Channel.prototype.write = function (data) {
	this.conn.write('msg,' + this.topic + ',' + data);
};
Channel.prototype.end = function (data) {
	var _this = this;

	if (data) this.write(data);
	if (this.topic in this.channels) {
		this.conn.write('uns,' + this.topic);
		delete this.channels[this.topic];
		process.nextTick(function () {
			return _this.emit('close');
		});
	}
};
Channel.prototype.destroy = Channel.prototype.destroySoon = function () {
	this.removeAllListeners();
	this.end();
};

exports['default'] = Channel;
module.exports = exports['default'];