var cors = require('cors');
const express = require('express');
const app = express();
const _ = require("lodash");
const { forEach } = require('lodash');
const { isAbsolute } = require('path');
app.use(cors({ credentials: true, origin: true }));
const http = require('http').Server(app);

const io = require('socket.io')(http);
const port = process.env.PORT || 7000;
const request = require("request");
const axios = require('axios').default;

const SERVICE_KEY = `2tBIO24MpVQ1W6vv214r6C7UqP7JCrAuZRKRU7uwWLL1K8pyUXSsue8o3oUAegRTXhkT7PrugzTPP29kN9AK47U42jKTS6Fu9r3b6x7o3L70yUt6BmEL1Yn7I36yeB40`;
const AUTH_SERVICE_URL = `https://auth-service.glitch.me`;
const MAIN_SERVICE_URL = `https://gmgraphql.glitch.me`;

const AUTH_SERVICE_RESPONSE_TYPES = {
	SUCCESSFUL: "SUCCESSFUL",
	FAILED: "FAILED",
	WRONG_PWD: "WRONG_PWD",
	WRONG_USERNAME: "WRONG_USERNAME",
	SESSION_EXPIRED: "SESSION_EXPIRED",
	IS_BANNED_ACCOUNT: "IS_BANNED_ACCOUNT",
	IS_UNACTIVATED_ACCOUNT: "IS_UNACTIVATED_ACCOUNT",
}

const ROOM_TYPES = {
	PUBLIC: 'public',
	PRIVATE: 'private',
	HIDDEN: 'hidden'
}



class Option {
	constructor(isAbsolute, roomSize, socketRoomId, gameId) {
		this.isAbsolute = isAbsolute;
		this.roomSize = roomSize;
		this.gameId = gameId;
		this.socketRoomId = socketRoomId;
		this.roomId = null;
		this.subcribers = [];
		this.members = [];
	}
}

class Subcriber {
	constructor(accountId, socketId) {
		this.accountId = accountId;
		this.socketIds = [socketId];
	}
}

class ResultCRUD {
	constructor(raw) {
		this.status = raw.status,
			this.payload = raw.payload,
			this.success = raw.success,
			this.message = raw.message
	}
}
















function getIndexOfSubcriberByAccountId(subcribers, accountId) {
	const subcriber = subcribers.find((subcriber) => (subcriber.accountId === accountId));
	if (subcriber != null) {
		return subcribers.indexOf(subcriber);
	}

	return -1;
}

function findSocketId(socketIds, socketId) {
	return socketIds.find(element => element === socketId);
}

function getIndexOfSubcriberBySocketId(subcribers, socketId) {
	const subcriber = subcribers.find((subcriber) => (findSocketId(subcriber.socketIds, socketId) != null));
	if (subcriber != null) {
		return subcribers.indexOf(subcriber);
	}

	return -1;
}

function getIndexOfOptionByAccountId(options, accountId) {
	const option = options.find((option) => {
		const subcribers = option.subcribers;
		const subcriberIndex = getIndexOfSubcriberByAccountId(subcribers, accountId);

		return subcriberIndex > -1 && findSocketId(subcribers[subcriberIndex].socketIds, accountId) != null;
	});
	if (option != null) {
		return options.indexOf(option);
	}

	return -1;
}

function getIndexOfOptionBySocketId(options, socketId) {
	const option = options.find((option) => {
		const subcribers = option.subcribers;
		const subcriberIndex = getIndexOfSubcriberBySocketId(subcribers, socketId);

		return subcriberIndex > -1 && findSocketId(subcribers[subcriberIndex].socketIds, socketId) != null;
	});
	if (option != null) {
		return options.indexOf(option);
	}

	return -1;
}

function convertNumArrayToString(array) {
	let stringResult = '';

	array.forEach((element) => {
		stringResult += `"${element}",`;
	});

	return stringResult.substring(0, stringResult.length - 1);
}

function getAccountIdsInOption(option) {
	const accountIds = [];

	option.subcribers.forEach((subcriber) => {
		accountIds.push(subcriber.accountId);
	})

	return accountIds;
}

async function createRoom(option, accessToken) {
	return await requestToAnotherServer({
		method: "POST",
		headers: {
			token: accessToken
		},
		url: MAIN_SERVICE_URL + '/graphql',
		data: {
			operationName: null,
			variables: {},
			query: `
				mutation {
					createRoom(
						roomInput: {
							roomName: "${Date.now()}", 
							roomType: ${ROOM_TYPES.PUBLIC}, 
							maxOfMember: ${option.roomSize},
							game:{
								gameID: "${option.gameId}"
							}
							member: [${convertNumArrayToString(getAccountIdsInOption(option))}]
						}
						needApproved: false
					) {
						success
						message
						status
						payload
					}
				}
			`.split('\t').join('')
		}
	});
}

function triggerOption(options, option, socket, accessToken) {
	if (option.subcribers.length >= option.roomSize && accessToken) {
		// console.log('trigger at: ' + socket.id);////////////////////////////
		// console.log('\n\n');////////////////////////////
		createRoom(option, accessToken)
			.then((result) => {
				// console.log('success: ' + socket.id);////////////////////////////
				// console.log('\n\n');////////////////////////////
				const response = result.data;
				
				io.of('/').in(option.socketRoomId).emit('FINDING_RESULT', new ResultCRUD({
					payload: response.data.createRoom.payload,
					success: true
				}));
				
				//remove this option
				options.splice(options.indexOf(option), 1);
				//leave all members
				io.of('/').clients(option.socketRoomId).forEach((s) => {
					console.log(s);////////////////////////////
					s.leave(option.socketRoomId);
				});
				
				// console.log('io.sockets.adapter.rooms');////////////////////////////
				// console.log(io.sockets.adapter.rooms);////////////////////////////
			})
			.catch((error) => {
				// console.log('error: ' + socket.id);////////////////////////////
				// console.log('\n\n');////////////////////////////

				notification(socket, {
					success: false,
					payload: error,
					message: 'room creating failed'
				});
				console.log(error);////////////////////////////
			});
	} else {

	}
}

function pushSocketIdToItsSubcriber(subcribers, accountId, socketId) {
	const subcriberIndex = getIndexOfSubcriberByAccountId(subcribers, accountId);
	if (subcriberIndex > -1) {
		if (findSocketId(subcribers[subcriberIndex].socketIds, socketId) == null) {
			subcribers[subcriberIndex].socketIds.push(socketId);
		}
	} else {
		subcribers.push(new Subcriber(accountId, socketId));
	}
}

function popSocketIdToItsSubcriber(subcribers, socketId) {
	const subcriberIndex = getIndexOfSubcriberBySocketId(subcribers, socketId);
	if (subcriberIndex > -1) {
		const socketIdIndex = subcribers[subcriberIndex].socketIds.indexOf(socketId);
		if (socketIdIndex > -1) {
			subcribers[subcriberIndex].socketIds.splice(socketIdIndex, 1);

			//remove this subcriber if its socketIds are empty 
			if (subcribers[subcriberIndex].socketIds.length < 1) {
				subcribers.splice(subcriberIndex, 1);
			}
		}
	}
}

function popSubcriber(subcribers, accountId) {
	const subcriberIndex = getIndexOfSubcriberByAccountId(subcribers, accountId);
	if (subcriberIndex > -1) {
		subcribers.splice(subcriberIndex, 1);
	}
}

function joinSocketRoom(socket, socketRoomId) {
	socket.join(socketRoomId);
	console.log(socket.id + '\tjoin\n\n');////////////////////////////
	// console.log(io.sockets.adapter.rooms);////////////////////////////
	// __options.forEach((option) => console.log(option.subcribers));////////////////////////////


}

function findOption(options, roomSize, isAbsolute) {
	return options.find((option) => (option.roomSize === roomSize && option.isAbsolute === isAbsolute));
}

function createOptionIfItsNotExist(options, socket, roomSize, isAbsolute, gameId) {
	let option = findOption(options, roomSize, isAbsolute);
	if (option == null) {
		option = new Option(isAbsolute, roomSize, socket.id, gameId);
		options.push(option);
	}

	return option;
}

async function requestToAnotherServer(options) {
	options['json'] = true;

	return await axios(options);
}

async function handleAccessToken(accessToken) {
	return await requestToAnotherServer({
		method: "GET",
		headers: {
			secret_key: SERVICE_KEY,
			token: accessToken
		},
		url: AUTH_SERVICE_URL + '/auth'
	});
}

function notification(
	socket,
	{
		status = 200,
		payload = null,
		success = false,
		message = ''
	}
) {
	socket.emit('NOTIFICATION', new ResultCRUD({
		status: status,
		payload: payload,
		success: success,
		message: message
	}));
}

function auth(socket, accessToken, successCalback) {
	if (accessToken) {
		handleAccessToken(accessToken)
			.then((result) => {
				const response = result.data;
				// console.log(response);////////////////////////////////////////
				
				if (response.status === AUTH_SERVICE_RESPONSE_TYPES.SUCCESSFUL) {
					const accountId = response.data.accountId;
					successCalback(accessToken, accountId);
				} else {
					notification(socket, {
						success: false,
						payload: response,
						message: 'authentication failed'
					});
				}
			})
			.catch((error) => {
				const response = error.data;

				notification(socket, {
					success: false,
					payload: response,
					message: 'authentication failed'
				});
				console.log('authentication failed');////////////////////////////////////////
				console.log(error);////////////////////////////////////////
			});
	} else {
		notification(socket, {
			success: false,
			message: 'missing the token'
		});
	}
}










const __options = [];

io.on("connection", (socket) => {

	socket.on("IS_FINDING_ROOMS", (data) => {
		auth(socket, data.accessToken,
			(accessToken, accountId) => {
				
			}
		);
	})

	socket.on("FIND_ROOMS", (data) => {
		auth(socket, data.accessToken,
			(accessToken, accountId) => {
				// console.log(accessToken);////////////////////////////////////////
				let option = data.option;
				const socketId = socket.id;

				if (option && accountId && option.roomSize && option.isAbsolute && option.gameId) {
					option = createOptionIfItsNotExist(__options, socket, option.roomSize, option.isAbsolute, option.gameId);

					pushSocketIdToItsSubcriber(option.subcribers, accountId, socketId);
					joinSocketRoom(socket, option.socketRoomId);
					triggerOption(__options, option, socket, accessToken);
				} else {
					notification(socket, {
						success: false,
						message: 'wrong data format'
					});
				}
			}
		);
	})

	socket.on("UNFIND_ROOMS", (data) => {
		auth(socket, data.accessToken,
			(accessToken, accountId) => {
				const optionIndex = getIndexOfOptionByAccountId(__options, accountId);
				if (optionIndex > -1) {
					popSubcriber(__options[optionIndex].subcribers, accountId);

					//remove this option if it has not any subcribers
					if (__options[optionIndex].subcribers.length < 1) {
						__options.splice(optionIndex, 1);
					}
				}
			}
		);
	})



	socket.on('disconnect', () => {
		socket.disconnect();

		//remove socketId of its account
		const optionIndex = getIndexOfOptionBySocketId(__options, socket.id);
		if (optionIndex > -1) {
			popSocketIdToItsSubcriber(__options[optionIndex].subcribers, socket.id);

			//remove this option if it has not any subcribers
			if (__options[optionIndex].subcribers.length < 1) {
				__options.splice(optionIndex, 1);
			}
		}
	})
})


















http.listen(port, () => {
	console.log('listening on PORT: ' + port);
    /* mongoose.Promise = global.Promise;
     mongoose.set('useFindAndModify', false);
     mongoose.set('debug', true);
     mongoose.connect(process.env.CONNECTIONS, { useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true }, (res, err) => {
         console.log('Connected to MongoDB');
     })*/
})