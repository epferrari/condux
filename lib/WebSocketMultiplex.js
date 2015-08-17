

// ****

'use strict';

Object.defineProperty(exports, '__esModule', {
		value: true
});
var DumbEventTarget = function DumbEventTarget() {
		this._listeners = {};
};
DumbEventTarget.prototype._ensure = function (type) {
		if (!(type in this._listeners)) this._listeners[type] = [];
};
DumbEventTarget.prototype.addEventListener = function (type, listener) {
		this._ensure(type);
		this._listeners[type].push(listener);
};
DumbEventTarget.prototype.emit = function (type) {
		var _this = this;

		this._ensure(type);
		var args = Array.prototype.slice.call(arguments, 1);
		if (this['on' + type]) this['on' + type].apply(this, args);
		this._listeners[type].forEach(function (listener) {
				return listener.apply(_this, args);
		});
};

// ****

var Channel = function Channel(ws, name, channels) {
		var _this2 = this;

		DumbEventTarget.call(this);
		this.ws = ws;
		this.name = name;
		this.channels = channels;
		var onopen = function onopen() {
				_this2.ws.send('sub,' + _this2.name);
				_this2.emit('open');
		};
		if (ws.readyState > 0) {
				setTimeout(onopen, 0);
		} else {
				this.ws.addEventListener('open', onopen);
		}
};
Channel.prototype = new DumbEventTarget();

Channel.prototype.send = function (data) {
		this.ws.send('msg,' + this.name + ',' + data);
};
Channel.prototype.close = function () {
		var _this3 = this;

		this.ws.send('uns,' + this.name);
		delete this.channels[this.name];
		setTimeout(function () {
				_this3.emit('close', {});
		}, 0);
};

// ****

function WebSocketMultiplex(ws) {
		var _this4 = this;

		this.ws = ws;
		this.channels = {};
		this.ws.addEventListener('message', function (e) {
				var t = e.data.split(','),
				    type = t.shift(),
				    name = t.shift(),
				    payload = t.join(),
				    sub = _this4.channels[name];
				if (!sub) {
						return;
				}
				if (type === 'uns') {
						delete _this4.channels[name];
						sub.emit('close', {});
				} else if (type === 'msg') {
						sub.emit('message', { data: payload });
				}
		});
}

WebSocketMultiplex.prototype.channel = function (rawName) {
		var newChannel = new Channel(this.ws, global.escape(rawName), this.channels);
		this.channels[global.escape(rawName)] = newChannel;
		return newChannel;
};

exports['default'] = WebSocketMultiplex;
module.exports = exports['default'];