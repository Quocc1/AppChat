const moment = require('moment');

function formatMessage(room, username, content) {
  return {
    room,
    username,
    content,
    time: moment().format('h:mm a')
  };
}

module.exports = formatMessage;
