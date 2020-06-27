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





class Option {
	constructor(isAbsolute, roomSize, socketRoomId) {
		this.isAbsolute = isAbsolute;
		this.roomSize = roomSize;
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
















function getIndexOfSubcriberByAccountId(subcribers, accountId) {
	const subcriber = subcribers.find(subcriber => (subcriber.accountId === accountId));
	if (subcriber != null) {
		return subcribers.indexOf(subcriber);
	}

	return -1;
}

function findSocketId(socketIds, socketId) {
	return socketIds.find(element => element === socketId);
}

function getIndexOfSubcriberBySocketId(subcribers, socketId) {
	const subcriber = subcribers.find(item => (findSocketId(item.socketIds, socketId) != null));
	if (subcriber != null) {
		return subcribers.indexOf(subcriber);
	}

	return -1;
}

function getIndexOfOptionBySocketId(options, socketId) {
	const option = options.find(item => {
		const subcribers = item.subcribers;
		const subcriberIndex = getIndexOfSubcriberBySocketId(subcribers, socketId);

		return subcriberIndex > -1 && findSocketId(subcribers[subcriberIndex].socketIds, socketId) != null;
	});
	if (option != null) {
		return options.indexOf(option);
	}

	return -1;
}

function createRoom(option) {

}

function triggerOption(options, option, socket) {
	if (option.subcribers.length >= option.roomSize) {
		const findingResult = {
			hadFound: true
		};
		createRoom(option);
		socket.in(option.socketRoomId).emit('FINDING_RESULT', findingResult);

		//remove this option
		options.splice(options.indexOf(option), 1);
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

function joinSocketRoom(socket, socketRoomId) {
	socket.join(socketRoomId);
}

function findOption(options, roomSize, isAbsolute) {
	return options.find(option => (option.roomSize === roomSize && option.isAbsolute === isAbsolute));
}

function createOptionIfItsNotExist(options, socket, roomSize, isAbsolute) {
	let option = findOption(options, roomSize, isAbsolute);
	if (option == null) {
		option = new Option(isAbsolute, roomSize, socket.id);
		options.push(option);
	}

	return option;
}












const __options = [];

io.on("connection", async (socket) => {


	socket.on("FIND_ROOMS", async (data) => {
		let option = data.option;
		let accountId = data.accountId;
		const socketId = socket.id;

		if (option && accountId && option.roomSize && option.isAbsolute) {
			option = createOptionIfItsNotExist(__options, socket, option.roomSize, option.isAbsolute);

			pushSocketIdToItsSubcriber(option.subcribers, accountId, socketId);
			joinSocketRoom(socket, option.socketRoomId);
			triggerOption(__options, option, socket);
		} else {
			socket.emit('NOTIFICATION', 'wrong data format');
		}
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