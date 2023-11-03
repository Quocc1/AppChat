const moment = require('moment'); // Import thư viện 'moment' để làm việc với thời gian

function formatMessage(room, username, content) {
  return {
    room, // Tên phòng
    username, // Tên người gửi
    content, // Nội dung tin nhắn
    time: moment().format('h:mm a') // Thời gian gửi
  };
}

module.exports = formatMessage;
