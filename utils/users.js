const users = [];

// Lưu client khi tham gia vào phòng
function userJoin(id, username, room) {
  const user = { id, username, room };

  users.push(user);

  return user;
}

// Lấy client theo id
function getCurrentUser(id) {
  return users.find(user => user.id === id);
}

// Xóa client khi rời phòng
function userLeave(id) {
  const index = users.findIndex(user => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
}

// Lấy thông tin của mọi client có trong phòng
function getRoomUsers(room) {
  return users.filter(user => user.room === room);
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
};
