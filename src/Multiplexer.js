import Channel from './Channel.js';
import {EventEmitter} from 'events';

function Multiplexer(service) {
	this.registered_channels = {};
	this.service = service;
	this.service.on('connection',conn => {
			// hash of channels for the client connection
			var channels = {};

			conn.on('data', message => {
				var t = message.split(','),
						type = t.shift(),
						topic = t.shift(),
						payload = t.join();

				// the channel has not been created by the Multiplexer
				if(!this.registered_channels[topic]){
					// let the subscriber client know there is no channel available and return early
					if(type === "sub") conn.write("rej," + topic);
					return;
				}

				// the client connection is already subscribed to the channel
				if(channels[topic]){
					let sub = channels[topic];

					switch(type) {
						case 'uns':
							// unsubscrible the client from the channel
							delete channels[topic];
							sub.emit('close');
							break;
						case 'msg':
							sub.emit('data', JSON.parse(payload));
							break;
						case 'req':
							sub.emit('request',JSON.parse(payload));
							break;
					}
				} else if(type === "sub"){
					let sub = channels[topic] = new Channel(conn,topic,channels);
					this.registered_channels[topic].emit('connection', sub);
				}
			});

			// close the client connection destroy all subscribers
			conn.on('close', function(){
				var topics = Object.keys(channels);
				topics.forEach( topic => channels[topic].emit('close') );
				channels = {};
			});
	});
};

Multiplexer.prototype.registerChannel = function(name) {
	return this.registered_channels[escape(name)] = new EventEmitter();
};


export default Multiplexer;
