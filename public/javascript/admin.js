window.onbeforeunload = () => {
   alert("Are you sure you want to leave? Your chat connections will be lost.");
}

const socket = io();

socket.on('connect', () => {
  // Register as Admin
  $.post("/admin", { admin: socket.id }, (conversations) => {
    for (let conversation of conversations) {
      if (!conversation.accepted) {
        newChat(conversation.user, conversation.icon);
      }
    }
    
    updateUserOverview();
  });
});

socket.on('user matched', user_matched);

socket.on('chat message', function(data) {
  addMessage(data.room, createMessage('user', data.message));

  // Chat message received, so user is not typing anymore
  userNotTyping(data.room);
});

// removes a user from the waiting list
function user_matched(user) {
  console.log('user matched ' + user);

  // remove user from chat list if it exists
  for (let messageStream of chats) {
    if (messageStream.userId == user) {
        removeChat(user);
        break;
    }
  }
}

socket.on('user unmatched', (conversation) => {
  // TODO: display a message to the ear so they know this person was 
  //       disconnected from an admin
  newChat(conversation.user, conversation.icon);
  updateUserOverview();
});

socket.on('user disconnect', pause_chat);

function pause_chat(user) {
  console.log('user disconnected ' + user);

  pauseChat(user);

  toggleChat(CURRENT_CHAT_USER_ID);
}

socket.on('user gone for good', delete_chat);

function delete_chat(user) {
  console.log('user chat being deleted ' + user);

  deactivateChat(user);

  toggleChat(CURRENT_CHAT_USER_ID);
}

socket.on('user reconnect', resume_chat);

function resume_chat(user) {
  console.log('user reconnected ' + user);

  reactivateChat(user);

  toggleChat(CURRENT_CHAT_USER_ID);
}

// ends a chat with given user
// function end_chat(user) {
  /* TODO: Conversations stick around for some time after the user leaves
   * to allow for reconnections. The chat should no longer 
   * be deactivated immediately.
   * Instead, the admin should receive a notice that the user has
   * left, and receive another notive when the user returns.
   */

  // console.log('user disconnected ' + user);

  // deactivateChat(user);

  /*
  // reload the current window:
  toggleChat(CURRENT_CHAT_USER_ID);
  */
// }

socket.on('user waiting', user_waiting);

function user_waiting(user, icon) {
  console.log('user waiting ' + user);
  console.log('creating new chat for user waiting');
  newChat(user, icon);
  updateUserOverview();
}


socket.on('typing', user_typing);

function user_typing(data) {
  userIsTyping(data.room);
}

socket.on('stop typing', user_stop_typing);

function user_stop_typing(data) {
  userNotTyping(data.room);
}

// RECEIVE ^^^
///////////////////////////////////////
// SEND    vvv

function send_message(user, msg) {
  socket.emit('chat message', {
    message: msg,
    room: user
  });
}

// accepts a waiting user
function accept_user(user) {
  socket.emit('accept user', user);
}

function send_typing_message(user_id, is_typing) {
  if (is_typing == true) {
    socket.emit('typing', {
      room: CURRENT_CHAT_USER_ID
    });
  } else {
    socket.emit('stop typing', {
      room: CURRENT_CHAT_USER_ID
    });
   }
}


chats = [];
CURRENT_CHAT_USER_ID = '';
const ICON_SRC = "img/Animal Icons Small.png";

/**************************** INITIALIZE ****************************/

function initialize() {
    // Can be used for testing:
    // mockChats();
    // populateChat();
    updateUserOverview();
    generateAdminHeader();
}

/**************************** FUNCTIONS FOR DISPLAY UPDATES ****************************/


// updates the left chat menu to catch newly added users
function updateUserOverview() {
    tab = document.getElementsByClassName("tab")[0];
    tab.innerHTML = '';

    for (chat of chats) {
        selectedChat = chat.userId == CURRENT_CHAT_USER_ID ? "id='selectedTab'" : "";
        let iconTag = "";
        let iconText = "";

        if (isNaN(parseInt(chat.icon))) {
            iconTag = "<img class='icon' src='" + ICON_SRC + "' id='" + chat.icon + "'>";
            iconText = chat.icon.charAt(0).toUpperCase() + chat.icon.slice(1);
        } else {
            iconTag = "<div class='icon'>" + chat.icon + "</div>";
            iconText = "User " + chat.icon;
        }

        messagePreview = chat.messages.length == 0 ? '' : chat.messages[chat.messages.length - 1].message;
        typing = chat.typing ? ' id=typing' : '';
        alert = chat.alert ? ' id=alert' : '';
        tab.innerHTML = tab.innerHTML
                      + "<button class='btn btn-light' " + selectedChat
                      + " onclick='toggleChat(`" + chat.userId + "`)'>"
                        + "<div class='iconParent'>" + iconTag + "</div>"
                        + "<div class='notIcon'>"
                          + "<div class='buttonText'>"
                              + "<div class='buttonId'>" + iconText + "</div>"
                              + "<div class='messagePreview'>" + messagePreview + "</div>"
                          + "</div>"
                          + "<div class='buttonTypingDiv'" + typing + ">"
                              + "<img class='buttonTypingIcon' src='img/typing_icon.png'>"
                          + "</div>"
                          + "<div class='alertBar'" + alert + "></div>"
                        + "</div>"
                      + "</button>";
    }
}

function clearView() {
    $('.chatAction').html("");
    $('.messages').html("");
}

function toggleChat(userId) {
    updateCurrentInput(CURRENT_CHAT_USER_ID);
    CURRENT_CHAT_USER_ID = userId
    tabId = 0;
    for (chat of chats) {
        if (chat.userId == userId) {
            currentChat = document.getElementsByClassName("messages")[0];
            currentChat.innerHTML = "";
            for (message of chat.messages) {
                messageSide = message.role == 'admin' ? 'right' : 'left';
                currentChat.innerHTML = currentChat.innerHTML + createMessageDiv(messageSide, message.message, message.timestamp)
            }

            currentUserTyping = chat.typing ? 'block' : 'none';
            $('#typingIcon').css('display', currentUserTyping);

            actionDiv = document.getElementsByClassName("chatAction")[0];
            if (!chat.accepted) {
                actionDiv.innerHTML = "<button id='accept' class='btn btn-light' onclick='acceptChat(CURRENT_CHAT_USER_ID)'>Accept Thread</button>"
            }
            else if (chat.active) {
                actionDiv.innerHTML = chatElements(chat.currentMessage);
                chatSetup(sendMessage);
                scrollDown()
            }
            else if (chat.reconnecting) {
                actionDiv.innerHTML = "<div id='pause'>User Disconnected...</div>";
            }
            else {
                actionDiv.innerHTML = "<button id='delete' onclick='removeChat(CURRENT_CHAT_USER_ID)'>Delete Thread</button>";
            }
        }
        tabId++;
    }

    scrollDown()
    updateUserOverview();
}

function scrollDown() {
  let mbox = $('.messagesBox').first();
  mbox.scrollTop(mbox.prop('scrollHeight') - mbox.prop('clientHeight'));
}

function updateCurrentInput(userId) {
    for (chat of chats) {
        if (chat.userId == userId && chat.accepted && chat.active) {
            currentMessage = $('#inputBox').val();
            chat.currentMessage = currentMessage;
        }
    }
}

/**************************** SINGLE CHAT FUNCTIONS ****************************/

/*
    Given a user identifier, creates a new chat for that user if the identifier is unique
    and logs an error if it is a duplicate
*/
function newChat(userId, icon) {
    console.log("new chat");
    validUser = true;
    for (chat of chats) {
        if (userId == chat.userId) {
            console.log(Error('Cannot have multiple chats with identical user identifiers'));
            validUser = false;
        }
    }
    if (validUser) {
        chats.push(
            { userId: userId,
              messages: [],
              accepted: false,
              active: true,
              typing: false,
              icon: icon,
              alert: true,
              reconnecting: false,
              currentMessage: "" }
        );
    }
}

function reactivateChat(userId) {
    foundUser = false;
    for (chat of chats) {
        if (userId == chat.userId) {
            chat.active = true;
            chat.typing = false;
            chat.alert = true;
            chat.reconnecting = false;
            foundUser = true;
            updateUserOverview();
        }
    }
    if (!foundUser) {
        console.log(Error('User with given identifier could not be found'));
    }
}

function pauseChat(userId) {
    foundUser = false;
    for (chat of chats) {
        if (userId == chat.userId) {
            chat.active = false;
            chat.typing = false;
            chat.alert = true;
            chat.reconnecting = true;
            foundUser = true;
            updateUserOverview();
        }
    }
    if (!foundUser) {
        console.log(Error('User with given identifier could not be found'));
    }
}

function deactivateChat(userId) {
    foundUser = false;
    for (chat of chats) {
        if (userId == chat.userId) {
            chat.active = false;
            chat.typing = false;
            chat.alert = true;
            chat.reconnecting = false;
            foundUser = true;
            updateUserOverview();
        }
    }
    if (!foundUser) {
        console.log(Error('User with given identifier could not be found'));
    }
} 

function acceptChat(userId) {
  acceptChatUI(userId);
  accept_user(userId);
}

function acceptChatUI(userId) {
  foundUser = false;
  for (chat of chats) {
      if (userId == chat.userId) {
          chat.accepted = true;
          chat.alert = false;
          foundUser = true;
      }
  }
  if (!foundUser) {
      console.log(Error('User with given identifier could not be found'));
  }
  toggleChat(userId);
}

function removeChat(userId) {
    console.log('remove chat with ' + userId);
    foundUser = false;
    newChats = [];
    for (chat of chats) {
        if (userId == chat.userId) {
            chat.active = false;
            foundUser = true;
        } else {
            newChats.push(chat);
        }
    }
    chats = newChats;
    if (!foundUser) {
        console.log(Error('User with given identifier could not be found'));
    }
    updateUserOverview();
    clearView();
    if (chats.length > 0) {
        toggleChat(chats[0].userId)
    }
}

function userIsTyping(userId) {
    for (chat of chats) {
        if (userId == chat.userId) {
            chat.typing = true;
        }
    }
    updateUserOverview();
    if (userId == CURRENT_CHAT_USER_ID) {
        showCurrentTyping(true);
        scrollDown();
    }

}

function userNotTyping(userId) {
    for (chat of chats) {
        if (userId == chat.userId) {
            chat.typing = false;
        }
    }
    updateUserOverview();
    if (userId == CURRENT_CHAT_USER_ID) {
        showCurrentTyping(false);
    }

}

function showCurrentTyping(userIsTyping) {
  currentUserTyping = userIsTyping ? 'block' : 'none';
  $('#typingIcon').css('display', currentUserTyping);
}


/**************************** SINGLE MESSAGE FUNCTIONS ****************************/


/*
    To create a message object, we use the function createMessage. Given a role and a message string,
    this function appends creates a new messageObject that can be sent to addMessage.
*/
function createMessage(role, messageString) {
  return { role: role, message: escapeMessage(messageString), timestamp: new Date() };
}

function sendMessage() {
    message = $('#inputBox').val();
    if (message != '') {
        console.log("sending message")
        message = $('#inputBox').val();
        send_message(CURRENT_CHAT_USER_ID, message);
        messageObject = createMessage("admin", message);

        addMessage(CURRENT_CHAT_USER_ID, messageObject);

        message = $('#inputBox').val('');
    }

}

/*
    Given a user identifier and a messageObject, appends the message object to that user's
    chat if it exists, logs an error if that user chat doesn't exist
*/
function addMessage(userId, messageObject) {
    foundUser = false;
    for (chat of chats) {
        if (userId == chat.userId) {
            chat.messages.push(messageObject);
            chat.alert = true;
            foundUser = true;
            if (userId == CURRENT_CHAT_USER_ID) {
                currentChat = document.getElementsByClassName("messages")[0];
                messageSide = 'left';
                if (messageObject.role == 'admin') {
                    chat.alert = false;
                    messageSide = 'right';
                }
                currentChat.innerHTML = currentChat.innerHTML + createMessageDiv(messageSide, messageObject.message, messageObject.timestamp);
            }
        }
        scrollDown();
    }
    if (!foundUser) {
        console.log(Error('User with given identifier could not be found'));
    }
    updateUserOverview();
}



/**************************** TESTING FUNCTIONS ****************************/

function mockChats() {

    newChat('user1');
    newChat('user2');
    newChat('user3');
    newChat('this_is_a_really_long_username')

    message = createMessage('user', 'hi');
    addMessage('user1', message);
    addMessage('user2', message);
    addMessage('user3', message);

    message = createMessage('admin', 'hi user1');
    addMessage('user1', message);

    message = createMessage('admin', 'hi user2');
    addMessage('user2', message);
    message = createMessage('user', 'blah blah');
    addMessage('user2', message);

    message = createMessage('admin', 'hi user3');
    addMessage('user3', message);

    // acceptChat('user2');
    // acceptChat('user3');
    deactivateChat('user3');
}

function populateChat() {
    for (i = 0; i < 10; i++) {
        message = createMessage('user', 'short test');
        addMessage('user1', message);
        message = createMessage('admin', 'short test');
        addMessage('user1', message);
    }
    for (i = 0; i < 10; i++) {
        message = createMessage('user', 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test ');
        addMessage('user1', message);
        message = createMessage('admin', 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test '
            + 'this is a long test ');
        addMessage('user1', message);
    }

}
