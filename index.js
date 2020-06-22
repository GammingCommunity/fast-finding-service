var cors = require('cors');
const app = express();
app.use(cors({ credentials: true, origin: true }));
const io = require('socket.io')(http);
const http = require('http').Server(app);
const port = process.env.PORT || 7000;


io.on("connection", async (socket) => {
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