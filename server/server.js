var express = require('express'),
    http    = require('http'),
    app     = express(),
    server  = http.createServer(app),
    io      = require('socket.io').listen(server,{ log: false }),
    playerList = {};

server.listen(8085);

// Serving normal files
app.use(express.static(__dirname + '/'));

// Sockets functionality
io.sockets.on('connection', function (socket) {

    console.log("A new client is joining");
    socket.on("scores", function(data){
        socket.emit('scores', playerList);
    });

    // Handling register
    socket.on("register", function (data) {

        socket.set("id",data.id);

        if (playerList[data.id] === undefined) {

            playerList[data.id] = {};
            playerList[data.id].name = data.name;
            socket.emit("start");
            console.log("Client " + playerList[data.id].name + 
                        " joined the multiplayer game");
        } else {
            socket.emit("start");
            // Send or not acknowledgment for registering ????
        }
    });

    socket.on("score", function (data) {

        var id = data.id;

        playerList[id].score = data.score;
        playerList[data.id].end = false;
        console.log(playerList);
        
        socket.broadcast.emit('scores', playerList);

        console.log("Player: "+ playerList[id].name + 
                    " score: " + data.score);
    });

    socket.on('win', function (data){
        var gameFinished = true;
        //console.log("Player " + playerList[data.id].name + " won the game");
        playerList[data.id].end = true;
        console.log(playerList);

        for (var i in playerList) {
            if (playerList[i].end == false) {
                gameFinished = false;
                break;
            }
        }

        if(gameFinished) {
            socket.broadcast.emit('win', playerList);
            socket.emit('win', playerList);
        }
    });

    socket.on('disconnect', function (data) {

        console.log("Disconnection");
        console.log(data);
        // iPhone sends socket end on disconnection
        if(data === "booted" || ((data) && data.indexOf("socket end")) >= 0){

            socket.get("id", function (error,id){
                if (error) {
                    console.log(error);
                } else {
                    console.log(" ID : " + id);
                    delete playerList[id];
                }
                socket.broadcast.emit('scores', playerList);
                socket.broadcast.emit('remove', id);
                console.log("Player " + id + " left the game");
            });
        }
    });
});
