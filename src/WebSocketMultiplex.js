


		// ****

		var DumbEventTarget = function() {
				this._listeners = {};
		};
		DumbEventTarget.prototype._ensure = function(type) {
				if(!(type in this._listeners)) this._listeners[type] = [];
		};
		DumbEventTarget.prototype.addEventListener = function(type, listener) {
				this._ensure(type);
				this._listeners[type].push(listener);
		};
		DumbEventTarget.prototype.emit = function(type) {
				this._ensure(type);
				var args = Array.prototype.slice.call(arguments, 1);
				if(this['on' + type]) this['on' + type].apply(this, args);
				this._listeners[type].forEach( listener => listener.apply(this,args));
		};

		// ****

		var Channel = function(ws, name, channels) {
				DumbEventTarget.call(this);
				this.ws = ws;
				this.name = name;
				this.channels = channels;
				var onopen = () => {
						this.ws.send('sub,' + this.name);
						this.emit('open');
				};
				if(ws.readyState > 0) {
						setTimeout(onopen, 0);
				} else {
						this.ws.addEventListener('open', onopen);
				}
		};
		Channel.prototype = new DumbEventTarget();

		Channel.prototype.send = function(data) {
				this.ws.send('msg,' + this.name + ',' + data);
		};
		Channel.prototype.close = function() {
				this.ws.send('uns,' + this.name);
				delete this.channels[this.name];
				setTimeout(() => {
					this.emit('close', {});
				},0);
		};

		// ****

function WebSocketMultiplex(ws) {
	this.ws = ws;
	this.channels = {};
	this.ws.addEventListener('message', (e) => {
		var t = e.data.split(','),
				type = t.shift(),
				name = t.shift(),
				payload = t.join(),
				sub = this.channels[name];
		if(!sub) { return; }
		if(type === 'uns'){
			delete this.channels[name];
			sub.emit('close', {});
		}else if(type === 'msg'){
			sub.emit('message', {data: payload});
		}
	});
}

WebSocketMultiplex.prototype.channel = function(rawName) {
	var newChannel = new Channel(this.ws, global.escape(rawName), this.channels);
	this.channels[global.escape(rawName)] = newChannel;
	return newChannel;
};

export default WebSocketMultiplex;
