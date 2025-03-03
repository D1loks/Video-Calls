const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

const users = new Map();

io.on('connection', socket => {
    socket.on('requestUserList', (data) => {
        if (!data?.userName) {
            console.log('Invalid user data:', data);
            return;
        }

        console.log('User connected:', {
            socketId: socket.id,
            userName: data.userName
        });

        users.set(socket.id, {
            id: socket.id,
            name: data.userName
        });

        broadcastUserList();
    });

    socket.on('disconnect', () => {
        if (users.has(socket.id)) {
            users.delete(socket.id);
            // Відправляємо оновлений список всім користувачам
            broadcastUserList();
        }
    });

    socket.on('callUser', (data) => {
        socket.to(data.to).emit('incomingCall', {
            from: data.from,
            fromUserName: data.fromUserName,
            offer: data.offer
        });
    });

    socket.on('callAccepted', (data) => {
        socket.to(data.to).emit('callAccepted', {
            from: data.from,
            answer: data.answer
        });
    });

    socket.on('callRejected', (data) => {
        socket.to(data.to).emit('callRejected', {
            from: data.from
        });
    });

    socket.on('iceCandidate', (data) => {
        socket.to(data.to).emit('remotePeerIceCandidate', {
            candidate: data.candidate
        });
    });

    socket.on('hangUp', (data) => {
        socket.to(data.to).emit('hangUp');
    });

    // Додаємо функцію для розсилки оновленого списку
    function broadcastUserList() {
        const usersList = Array.from(users.values());
        console.log('Current users in Map:', usersList);
        
        io.emit('update-user-list', {
            users: usersList
        });
    }
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});