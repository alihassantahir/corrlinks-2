let REFRESH_INTERVAL=10;

const STATE = {
  stopNow: true,
  currentMessage: null

};

window.onload = () => {
  startUp()
  requestState()

};

async function startUp(reload) {
  if(STATE.stopNow) return
  const fn = 'startUp:';
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    await delay(1000);

    try {
      const corrlinks_account = await getCorrlinksAccount();

      if (corrlinks_account) {
        sendMessage({
          action: "SET_CORRLINKS_ACCOUNT",
          corrlinks_account
        });

        if (reload) {
          window.location.href = window.location.href;
        }
      }
    } catch (error) {
    }

    navigate();

  } catch (error) {
    console.error("Error in startUp function:", error);
    return;
  }
}

function requestState() {
  chrome.runtime.sendMessage({
    action: 'getState'
  }, (response) => {
    if (response && response.state) {
      const currentState = response.state;

      if (currentState) {
     if(isLoginPage())
{
autoLogin()
return
}
       startUp();
 



      }
     


    }
  });
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  switch (request.message) {

    case "START_INTEGRATION":
      STATE.stopNow = false;
      startUp(true);

      const corrlinks_account = await getCorrlinksAccount();
if (corrlinks_account) {


  // Send the message with both account and password
  sendMessage({
    action: "SET_CORRLINKS_ACCOUNT",
    corrlinks_account
  });
}
      return;

    case "STOP_INTEGRATION":
      STATE.stopNow = true;
      navigate(true)
      return;

    case "NEW_MESSAGE_FROM_WHATSAPP":
      processMessage(request.data);
      return;

    case "POLLING_SERVER":
      console.log("Polling the server...");
      requestState(); // Generating "event" to prevent SW from going idle
      return;


  }

});


async function getCorrlinksAccount() {
  const fn = 'retrieveAccountAddress:';

  const alreadyOpenedItem = document.getElementById('loggedInUser');

  if (alreadyOpenedItem) {
    return Promise.resolve(alreadyOpenedItem.innerText);
  }

  const userButton = document.querySelector('header button:has(div.user-initials)');
  if (!userButton) {
    return Promise.reject();
  }
  userButton.click();


  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const listItem = document.getElementById('loggedInUser');

      if (listItem) {
        resolve(listItem.innerText);
      } else {
        reject();
      }
    }, 500);
  });
}


function processMessage(message) {
  if (STATE.currentMessage) {
    console.log('Another message is in queue. Will retry sending message shortly...');
    addMessagetoQueue(message)
    return;
  }
  if (getPageType() === "NEW_MESSAGE") {
    STATE.currentMessage = message;
    let data = message.data.message
    
    if (!data) return
    let id = null,
      subject = null,
      body = null
    id = data.corrlinks_id;
    subject = data.subject;
    messagebody = data.body;
    msgID = data.id;
    if (id && subject && messagebody && msgID) {
      console.log("Message data: ", data)
      setTimeout(() => {
        openList();
        clickItem(id)
          .then((result) => {
            fillSubject(subject);
            fillMessage(messagebody);
            validateMessage(data.id);
          })
          .catch((error) => {
            STATE.currentMessage = null;
            sendMessage({
              type: "USER_NOT_FOUND_IN_CORRLINKS",
              id: id
            });
            navigate(true)

          });
      }, 500);
      return;
    }
  } else {
    addMessagetoQueue(message)
    navigate(true)
  }
}



function validateMessage(uniqueID) {
  setTimeout(() => {

    const subjectInput = document.querySelector('input[formcontrolname="subject"]');
    const messageInput = document.querySelector('textarea[formcontrolname="message"]');
    const isSubjectValid = subjectInput && subjectInput.value.trim() !== '';
    const isMessageValid = messageInput && messageInput.value.trim() !== '';
    if (isSubjectValid && isMessageValid) {
      console.log('All inputs are valid, proceeding to click Send');
      const buttons = document.querySelectorAll('button');
      const sendButton = Array.from(buttons).find(button => button.textContent.trim() === 'Send');
      if (sendButton) {
        sendButton.click();
        setTimeout(() => {
          if (successfullySent()) { //After 3s (MAX usually comes in 1s) there must be a Dialog box which confirms
            const deliveredID = {
              type: 'MESSAGE_DELIVERED',
              id: uniqueID
            };
            sendMessage(deliveredID)
            STATE.currentMessage = null;
            navigate(true)
          } else {
            const deliveredID = {
              type: 'MESSAGE_COULD_NOT_BE_DELIVERED',
              id: uniqueID
            };
            sendMessage(deliveredID)
            STATE.currentMessage = null;
            navigate(true)
          }
        }, 3000);
      } else //Submit button was disabled due to some error let Backend know about it so it can retry?
      {
        const deliveredID = {
          type: 'MESSAGE_COULD_NOT_BE_DELIVERED',
          id: uniqueID
        };
        sendMessage(deliveredID)
        STATE.currentMessage = null;
        navigate(true)
      }

    }
  }, 1000);
}


function openList() {
  const Main = document.querySelector('[formcontrolname="contacts"]');
  if (Main) {

    let downIcon = Main.querySelector('.e-down-icon');
    if (downIcon) {
      simulateClick(downIcon);

    }
  }
}


function fillSubject(text) {
  const inputBox = document.querySelector(`input[formcontrolname="subject"]`);

  if (!inputBox) return
  simulateClick(inputBox)
  inputBox.value = text;
  simulateInput(inputBox)
}

function fillMessage(text) {
  const inputBox = document.querySelector(`textarea[formcontrolname="message"]`);

  if (!inputBox) return
  simulateClick(inputBox)
  inputBox.value = text;
  simulateInput(inputBox)

  const MainMsgBox = document.querySelector('input[formcontrolname="message"][placeholder="Message"]');

  simulateClick(MainMsgBox) //This is necessary to remove ng-untouched class
}


async function clickItem(id) {
  return new Promise((resolve, reject) => {
    const Main = document.querySelector('.e-multi-select-list-wrapper');
    if (!Main) return reject("Main element not found");

    const activeItems = Main.querySelectorAll('.e-list-item.e-active');
    const listItems = Main.querySelectorAll('.e-list-item');

    function unCheckAll() {
      activeItems.forEach((activeItem) => {
        const checkboxWrapper = activeItem.querySelector('.e-checkbox-wrapper');
        if (checkboxWrapper) {
          simulateClick(checkboxWrapper, true);
        }
      });
    }
    unCheckAll(); //Uncheck any existing item before clicking the one that matches ID

    let userFound = false;
    listItems.forEach((item) => {
      const nameSpan = item.querySelectorAll('.recipient-item-desktop')[0]; //ID is contained in the first span of each item
      const match = nameSpan && nameSpan.textContent.match(/\((\d+)\)/);
      if (match && match[1] === id) {
        const checkboxWrapper = item.closest("li");
        if (checkboxWrapper) {
          specialClick(checkboxWrapper)
          userFound = true;
          resolve("USER FOUND IN CORRLINKS");
        }
      }
    });

    if (!userFound) {
      reject("USER NOT FOUND");
    }
  });
}

function getPageType() {

  let result = null;
  if (window.location.href.includes("https://www.corrlinks.com/en-US/mailbox/compose")) {
    result = "NEW_MESSAGE";

  }
  return result;
}


function addMessagetoQueue(msg) {

 let data = msg.data.message 
   if (!data) return
    let id = null,
    subject = null,
    body = null
    id = data.corrlinks_id;
    subject = data.subject;
    messagebody = data.body;
    msgID = data.id;

if(!id || !subject || !messagebody || !msgID) return 
  chrome.runtime.sendMessage({
    action: 'ADD_MSG_TO_QUEUE',
    message: msg

  });
}


function setState() {
  chrome.runtime.sendMessage({
    action: 'setState'
  });
}

function isComposePage() {
  return (window.location.href.includes("https://www.corrlinks.com/en-US/mailbox/compose"))
}


function isLoginPage() {
  const targetUrls = [
    'https://www.corrlinks.com/en-US/login',
    'https://www.corrlinks.com/es-US/login'
  ];

  return targetUrls.some(url => window.location.href === url);
}


function navigate(bypass) {
 // To compose message page
  if (window.location.href !== "https://www.corrlinks.com/en-US/mailbox/compose") {
    window.location.href = "https://www.corrlinks.com/en-US/mailbox/compose";
  } else if (bypass) {
    window.location.href = "https://www.corrlinks.com/en-US/mailbox/compose";
  }
}



function successfullySent() {
  if (isComposePage()) {
    const element = Array.from(document.querySelectorAll('div')).find(div => div.textContent.trim() === 'Message successfully sent.');
    return element !== undefined;
  }
  return false;
}




//Helper fns

function specialClick(element) {
  if (!element) return
  const mousedownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  const mouseupEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(mousedownEvent);
  element.dispatchEvent(mouseupEvent);
}

function simulateInput(element) {
  if (!element) return;
  const KBevent = new KeyboardEvent('keyup', {
    bubbles: true,
    cancelable: true,
    key: 'a',
    code: 'KeyA',
  });
  element.dispatchEvent(KBevent);
  element.dispatchEvent(new Event('input', {
    bubbles: true
  }));
  element.dispatchEvent(new Event('change', {
    bubbles: true
  }));
}

function simulateClick(element, nofocus) {
  if (!element) return;

  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  element.dispatchEvent(mouseDownEvent);

  setTimeout(() => {
    element.dispatchEvent(mouseUpEvent);
    if (!nofocus)
      element.focus();

    element.dispatchEvent(clickEvent);

  }, 100);
}

function sendMessage(message) {
  chrome.runtime.sendMessage(null, message);
}


function blurElement(element) {
    if (!element) return; 

    const event = new FocusEvent('blur', { 
        bubbles: true,
        cancelable: true,
        view: window
    });

    element.dispatchEvent(event);
}

let lastLoginTry = null;

function autoLogin() {
  const currentTime = new Date();

  if (lastLoginTry && (currentTime - lastLoginTry < 8000)) {
    return; 
  } else if (lastLoginTry && (currentTime - lastLoginTry > 30000)) {
    return; 
  }

  lastLoginTry = currentTime;

      const emailField = document.querySelector('input[formcontrolname="email"]');
      const passwordField = document.querySelector('input[formcontrolname="password"]');

      if (emailField && passwordField) {
        setField(emailField);
        setField(passwordField);
        
        const loginButton = Array.from(document.querySelectorAll('button'))
                                  .find(button => button.innerText === 'Login');

        setTimeout(() => {
          if (loginButton) {
            loginButton.click();
          }
        }, 3000);
      }


}

function setField(field) {
    simulateClick(field);
    simulateInput(field);
    blurElement(field);
}




