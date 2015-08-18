import Reflux from 'reflux';
import sockjs from 'sockjs-client';
import WebSocketMultiplex from './WebSocketMultiplex.js';


var uniqId =  function(){
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1).toUpperCase();
};

var ClientNexus = {};
var sock,mplex,actionChannel;

ClientNexus.initialize = function(prefix){
	sock = new sockjs(prefix || '/reflux-nexus');
	mplex = new WebSocketMultiplex(sock);
	actionChannel = mplex.channel('NEXUS_CLIENT_ACTIONS');
};

// returns a function that sends the ServerNexus a keyed object with actionType and payload
ClientNexus.createAction = function(actionName){
	return payload => actionChannel.send(JSON.stringify({
		actionType: actionName,
		payload: payload
	}));
};

// return a hash of action name keys with ClientNexus actions as values
ClientNexus.createActions = function(actionNames){
	return actionNames.reduce( (accum,actionName) => {
		accum[actionName] = this.createAction(actionName);
		return accum;
	},{});
};

function Channel(name){
	this.channelName = name;
	this.sock = mplex.channel(name);
	this.subscribers = {};
	this.sock.onmessage = (msg) => {
		Promise.all(this.subscribers.reduce( (accum,sub) => {
			accum.push(new Promise(function(resolve,reject){
				sub.handler.apply(sub.listener,[JSON.parse(msg.data)]);
				resolve();
			}));
			return accum;
		},[]));
	};

	this.sock.onclose = function(){};
};

Channel.prototype.addListener = function(subscriber){
	var token = uniqId();
	this.subscribers[token] = subscriber;
	return token;
};

Channel.prototype.removeListener = function(token){
	this.subscribers[token] = null;
};

ClientNexus.Channel = Channel;


function listenToChannel(channel,handler){
	let {addListener,removeListener,channelName} = channel;

	if(!(nexus instanceof Channel)){
		return new Error('First argument passed to .tuneIn must a Client Nexus Channel.');
	}

	if( !this.subscriptions[channelName] ){
		let token = addListener({
			handler: handler,
			listener: this
		});
		this._nexusTokens.push( removeListener.bind(channel,token) );
	}
}

/**
* Mixin for React Component
*/
ClientNexus.Connect = {

	componentWillMount(){
		this.tokens = {};
		this._nexusTokens = [];
		this.tuneIn = listenToChannel.bind(this);
	},

	componentWillUnmount(){
		this._nexusTokens.forEach(disposer => disposer());
	}
};

export {ClientNexus as default};


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
