import {Stream} from 'stream';

var Channel = function(conn,topic,channels) {
	this.conn = conn;
	this.topic = topic;
	this.channels = channels;
	Stream.call(this);
};

Channel.prototype = new Stream();
Channel.prototype.write = function(data){
	this.conn.write('msg,' + this.topic + ',' + data);
};
Channel.prototype.end = function(data){
	if(data) this.write(data);
	if(this.topic in this.channels){
			this.conn.write('uns,' + this.topic);
			delete this.channels[this.topic];
			process.nextTick(() => this.emit('close'));
	}
};
Channel.prototype.destroy = Channel.prototype.destroySoon = function(){
	this.removeAllListeners();
	this.end();
};

export default Channel;
