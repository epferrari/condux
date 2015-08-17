import Reflux from 'reflux';
import _ from 'lodash';
import sockjs from 'sockjs-client';
import WebSocketMultiplex from './WebSocketMultiplex';
import {uniqId} from '../helpers/utils';

var Nexus = {};
var sock,mplex,actionChannel;

Nexus.initialize = function(prefix){
	sock = new sockjs(prefix || '/reflux-nexus');
	mplex = new WebSocketMultiplex(sock);
	actionChannel = mplex.channel('CLIENT_ACTIONS');
};

Nexus.Client = function NexusClient(channel){
	this.channel = channel;
	this.sock = mplex.channel(channel);
	this.registered = {};
	this.sock.onmessage = (msg) => {
		Promise.all(_.map(this.registered, r => {
			return new Promise(function(resolve,reject){
				r.handler.apply(r.listener,[JSON.parse(msg.data)]);
				resolve();
			});
		}));
	};
	this.sock.onclose = function(){
		console.log('disconnected');
	};
};

Nexus.Client.prototype.addListener = function(listener){
	var uid = uniqId();
	this.registered[uid] = listener;
	return uid;
};

Nexus.Client.prototype.removeListener = function(token){
	this.registered[token] = null;
};

Nexus.clientAction = function(actionType){
	return payload => actionChannel.send(JSON.stringify({
		action: actionType,
		payload: payload
	}));
};

Nexus.clientActions = function(arr){
	return arr.reduce( (res,actionType) => {
		res[actionType] = this.clientAction(actionType);
		return res;
	},{});
};

Nexus.Connect = {
	componentWillMount: function(){
		this.nxsTokens = {};
		this.nxsClients = {};
		this.listenToNexus = (nexus,handler) => {
			if(!(nexus instanceof Nexus.Client)){
				return new Error('First argument passed to .listenToNexus must instance of NexusClient.');
			}
			if(!this.nxsClients[nexus.channel]){
				var token = nexus.addListener({
					handler: handler,
					listener: this
				});
				this.nxsClients[nexus.channel] = {
					token: token,
					disposer: () => {
						nexus.removeListener(token);
					}
				};
			}
		};
	},
	componentWillUnmount: function(){
		_.each(this.nxsClients,(r,channel) => {
			r.disposer();
		});
	}
};

export {Nexus as default};
