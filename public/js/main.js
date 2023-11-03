const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');

// Lấy username và room từ URL
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

const socket = io();

// Tham gia phòng
socket.emit('joinRoom', { username, room });

// Lấy thông tin phòng và users
socket.on('roomUsers', ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
});

// Lắng nghe message từ server
socket.on('message', (message) => {
  outputMessage(message);

  // Cuộn xuống tin nhắn mới nhất
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Message submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();

  // Lấy nội dung message
  let message = e.target.elements.message.value;

  message = message.trim();

  if (!message) {
    return false;
  }

  // Emit message đến server
  socket.emit('chatMessage', message);

  // Clear input
  e.target.elements.message.value = '';
  e.target.elements.message.focus();
});

// Cập nhật message lên DOM
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  const p = document.createElement('p');
  p.classList.add('meta');
  p.innerText = message.username;
  p.innerHTML += `<span>${message.time}</span>`;
  div.appendChild(p);
  const para = document.createElement('p');
  para.classList.add('text');
  para.innerText = message.content;
  div.appendChild(para);
  document.querySelector('.chat-messages').appendChild(div);
}

// Cập nhật tên phòng lên DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

// Cập nhật thông tin client lên DOM
function outputUsers(users) {
  userList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerText = user.username;
    userList.appendChild(li);
  });
}

// Hiện thông báo để xác nhận khi người dùng muốn rời phòng
document.getElementById('leave-btn').addEventListener('click', () => {
  const leaveRoom = confirm('Bạn có chắc muốn rời phòng?');
  if (leaveRoom) {
    window.location = '../index.html';
  } else {
  }
});
