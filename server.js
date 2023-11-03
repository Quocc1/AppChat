const Qs = require('qs')
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
io.on('connection', async (socket) => {
  let connection = null
  let channel = null

  socket.on('joinRoom', async ({ username, room }) => {
    result  = await connectRabbitmq()
    connection = await result['connection']
    channel = await result['channel']
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
    await produceMessage(channel, message, user);
    await consumeMessage(channel, user.room);
  });

  // Runs when client disconnects
  socket.on('disconnect', async () => {
    await disconnectRabbitmq(connection, channel)
    
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
async function connectRabbitmq() {
  try {
    const connection = await amqplib.connect('amqps://qqgwwzsh:s9lguwP2ROUN2_8x2GZQ1I1bevC2iYWj@octopus.rmq3.cloudamqp.com/qqgwwzsh');
    const channel = await connection.createChannel();
    return { connection, channel }
  } catch (err) {
    console.warn(err);
  }
}

async function disconnectRabbitmq(connection, channel) {
  try {
    await channel.close();
    await connection.close();
  } catch (err) {
    console.warn(err);
  }
}

async function produceMessage(channel, message, user) {
  try {
    const queue = 'sending-message-queue';
    const fullMessage = formatMessage(user.room, user.username, message);
    // const fullMessage = `${user.username}: ${message}`;
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(fullMessage)));
  } catch (err) {
    console.warn(err);
  } 
}

async function consumeMessage(channel, room) {
  try {
    const queue = 'receiving-message-queue';
    await channel.assertQueue(queue, { durable: true });
    
    await channel.consume(
      queue,
      (message) => {
        const messageObject = JSON.parse(message.content.toString());

        const room = messageObject.room;
        const username = messageObject.username;
        const content = messageObject.content;

        io.to(room).emit('message', formatMessage(room, username, content));
      channel.ack(message)
    },
      );
  } catch (err) {
    console.warn(err);
  } 
}