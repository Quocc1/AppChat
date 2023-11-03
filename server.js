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

const app = express(); // Tạo một ứng dụng Express
const server = http.createServer(app); // Tạo một máy chủ HTTP bằng Express
const io = socketio(server); // Kết nối WebSocket bằng Socket.IO với máy chủ HTTP

// Khởi tạo folder tĩnh khi kết nối đến user 
app.use(express.static(path.join(__dirname, 'public')));

const botName = 'Thông Báo';

// Socket.io khởi chạy khi client kết nối
io.on('connection', async (socket) => {
  let connection = null; // Connection để giao tiếp với RabbitMQ
  let channel = null; // Kênh để gửi/nhận thông điệp

  // Socket xử lý khi có client tham gia vào phòng
  socket.on('joinRoom', async ({ username, room }) => {
    // Kết nối đến RabbitMQ, lưu kết nối và kênh
    result = await connectRabbitmq();
    connection = await result['connection'];
    channel = await result['channel'];
    
    // Lưu thông tin client
    const user = userJoin(socket.id, username, room);

    // Join client vào phòng
    socket.join(user.room);

    // Broadcast thông báo về một client tham gia vào phòng
    socket.broadcast
      .to(user.room)
      .emit('message', formatMessage(user.room, botName, `${user.username} đã tham gia`));

    // Cập nhật thông tin về client và phòng
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // Lắng nghe khi client gửi tin nhắn
  socket.on('chatMessage', async (message) => {
    const user = await getCurrentUser(socket.id); // Lấy thông tin client
    await produceMessage(channel, message, user); // Kết nối đến Rabbitmq và produce message
    await consumeMessage(channel); // Kết nối đến Rabbitmq và consume message
  });

  // Lắng nghe khi có client ngắt kết nối
  socket.on('disconnect', async () => {
    await disconnectRabbitmq(connection, channel); // Ngắt kết nối đến Rabbitmq 

    const user = userLeave(socket.id);

    // Thông báo client đã rời phòng cho mọi client khác có trong phòng
    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(user.room, botName, `${user.username} đã rời phòng`)
      );

      // Cập nhật thông tin cho về client và phòng
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Hàm kết nối đến Rabbitmq
async function connectRabbitmq() {
  try {
    // Thực hiện tạo connection đến RabbitMQ và tạo channel
    const connection = await amqplib.connect(
      'amqps://qqgwwzsh:s9lguwP2ROUN2_8x2GZQ1I1bevC2iYWj@octopus.rmq3.cloudamqp.com/qqgwwzsh'
    );
    const channel = await connection.createChannel();
    return { connection, channel };
  } catch (err) {
    console.warn(err);
  }
}

// Hàm ngắt kết nối đến Rabbitmq
async function disconnectRabbitmq(connection, channel) {
  try {
    // Đóng channel và ngắt connection đến RabbitMQ
    await channel.close();
    await connection.close();
  } catch (err) {
    console.warn(err);
  }
}

// Hàm produce message từ Rabbitmq
async function produceMessage(channel, message, user) {
  try {
    const queue = 'sending-message-queue';
    const fullMessage = formatMessage(user.room, user.username, message); // Chuẩn bị thông điệp và gửi vào hàng đợi RabbitMQ
    await channel.assertQueue(queue, { durable: true }); // Tạo một 'sending-message-queue' queue
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(fullMessage))); // Gửi thông điệp vào queue
  } catch (err) {
    console.warn(err);
  }
}

// Hàm consume message từ Rabbitmq
async function consumeMessage(channel) {
  try {
    const queue = 'receiving-message-queue';
    await channel.assertQueue(queue, { durable: true }); // Tạo một 'receiving-message-queue' queue 
    
    // Lắng nghe queue và consume thông điệp khi có sẵn
    await channel.consume(
      queue,
      (message) => {
        const messageObject = JSON.parse(message.content.toString()); // Chuyển đổi dữ liệu
        io.to(messageObject.room).emit('message', messageObject); // Gửi tin nhắn đến tất cả các người dùng trong phòng
        channel.ack(message); // Xác nhận đã nhận thông điệp thành công
      },
    );
  } catch (err) {
    console.warn(err);
  }
}
