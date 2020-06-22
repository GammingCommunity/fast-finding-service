var cors = require('cors');
const express = require('express');
const app = express();
const _ = require("lodash");
app.use(cors({ credentials: true, origin: true }));
const http = require('http').Server(app);

const io = require('socket.io')(http);
const port = process.env.PORT || 7000;


io.on("connection", async (socket) => {
    var waiting_user = [];
    /**
    * data:{
    *   user_id
    *   game_id -> if nessasary
    *   time_out -> in mins
    *   room_type ->  4 or more
    * }
    * 
    * 
    */

    socket.on("fast-finding", async (data) => {
        var userInfo = {
            socket_id: socket.id,
            user_id: data.userID,
            room_type: data.roomType,
            time:Date.now(),
        }
        waiting_user.push(userInfo);
        


    })



    socket.on('disconnect', () => {
        socket.disconnect();
        //let s= listUser.find(e=>e.socketID ===socket.id);
        //listUser.splice(listUser.findIndex(e => e.socketID === socket.id), 1);
        //socket.emit('receiveList', listUser);
        console.log(socket.id + ' disconnected')
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