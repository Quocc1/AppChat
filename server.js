const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const amqplib = require('amqplib');
const formatMessage = require('./utils/messages');
require('dotenv').config();
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const botName = 'Bot';

// Run when client connects
io.on('connection', (socket) => {
  // console.log(io.of('/').adapter);
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit('message', formatMessage(botName, `${user.username} đã tham gia`));

    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // Listen for chatMessage
  socket.on('chatMessage', async (message) => {
    const user = await getCurrentUser(socket.id);
    await produceMessage(message);
    await consumeMessage(user);
  });

  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} đã rời phòng`)
      );

      // Send users and room info
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// RabbitMQ functions
async function produceMessage(message) {
  try {
    const connection = await amqplib.connect('amqps://qqgwwzsh:s9lguwP2ROUN2_8x2GZQ1I1bevC2iYWj@octopus.rmq3.cloudamqp.com/qqgwwzsh');
    const channel = await connection.createChannel();
    const queue = 'sending-message-queue';
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(message));
  } catch (err) {
    console.warn(err);
  } finally {
    await channel.close();
    await connection.close();
  }
}

async function consumeMessage(user) {
  try {
    const connection = await amqplib.connect('amqps://qqgwwzsh:s9lguwP2ROUN2_8x2GZQ1I1bevC2iYWj@octopus.rmq3.cloudamqp.com/qqgwwzsh');
    const channel = await connection.createChannel();
    const queue = 'receiving-message-queue';
    await channel.assertQueue(queue, { durable: true });

    await channel.consume(
      queue,
      (message) => {
        string_message = message.content.toString();
        io.to(user.room).emit('message', formatMessage(user.username, string_message));
      channel.ack(message)
    },
      );
  } catch (err) {
    console.warn(err);
  } finally {
    await channel.close();
    await connection.close();
  }
}