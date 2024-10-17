'use strict';
const APPNAME = 'Corrlinks Extension 2';
const SERVER = 'https://theeblvd.ngrok.io'; // this must be set to the ngrok server address here AND in Twilio's gateway. See README.md
console.debug('background:', `${APPNAME} background.js started`);
console.debug(`Current ngrok server address: ${SERVER}`);
console.log('To see all logs, set the console to VERBOSE');

const C = {
  DEFAULTS: {
    UPDATE_CONTENT_STATE_SECONDS: 10,
  },
  WEBSITE_DETAILS: {
    TITLE: 'CorrLinks',
    HOST: 'www.corrlinks.com',
    LOGIN: 'https://www.corrlinks.com/en-US/login'
  },
  MESSAGES: {
    START_INTEGRATION: 'START_INTEGRATION',
    STOP_INTEGRATION: 'STOP_INTEGRATION',
    NEW_MESSAGE_FROM_WHATSAPP: 'NEW_MESSAGE_FROM_WHATSAPP',
  },
  SERVER: {
    SERVER: SERVER,
    SEND_POST_MESSAGE: `${SERVER}/message-from-corrlinks`,
    GET_NEXT_MESSAGE: `${SERVER}/message-to-corrlinks`,
    NOTIFY_DELIVERY_STATUS: `${SERVER}/delivery-status-of-message-to-corrlinks`,
  }
};

const onIcon = {
  path: './images/cw-on.png'
};
const offIcon = {
  path: './images/cw-off.png'
};

let STATE = {
  running: false,
  tab: null,
  checkServerInterval: null,
  retrievingMessageFromServer: false,
  corrlinks_account: null,
  pswd:null,
  messageQueue: [],
};

chrome.action.onClicked.addListener(function() {
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function(tabs) {
    if (!STATE.running) {
      start();
    } else {
      stop();
      reloadTab(STATE.tab?.id);
    }
  });
});

function requestCorrlinksEmail()
{
	return STATE.corrlinks_account;
}

function requestCorrlinksPswd()
{
	return STATE.pswd;
}


function sendNewMessageNotification(data) {

  if (!STATE.tab) return

  const fn = 'sendNewMessageNotification:';
  try {
    const msg = {
      message: "NEW_MESSAGE_FROM_WHATSAPP",
      data: data
    };
    console.debug(fn, 'sending', {
      msg
    });
    chrome.tabs.sendMessage(STATE.tab.id, msg);
  } catch (error) {
    console.warn(fn, 'Error sending message:', error);
  }
}


function start() {
  const fn = 'Trying to initiate...';
  if (STATE.running) return false;

  chrome.tabs.query({
    currentWindow: true,
    active: true
  }, function(tabs) {
    const tab = tabs[0];
    STATE.tab = tab;

    const result = isValidSite(tab);

    if (result && !result.isValid) {
      handleInvalidSite(tab, result.msg);
      return;
    }
    else if(!result)
    {
	return
    }
    console.debug(fn, 'Sender extension successfully initiated...');
    chrome.action.setIcon(onIcon);
    STATE.running = true;

    const msg = {
      message: "START_INTEGRATION",
    };

    startServerCheck();
    sendMessageToTab(tab.id, msg);
  });
}

function stop() {
  const fn = 'stop:';
  console.debug(fn, 'stopping integration');
  chrome.action.setIcon(offIcon);

  const msg = {
    message: "STOP_INTEGRATION"
  };
  if (STATE.tab) sendMessageToTab(STATE.tab.id, msg);
  stopServerCheck()

  resetState();
}

function reloadTab(tabId) {
  if (tabId) {
    chrome.tabs.reload(tabId, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
      }
    });
  }
}

function handleInvalidSite(tab, msg) {
  resetState();
  showAlert(tab.id, tab.url, msg);
}

function isValidSite(tab, loggedOutCheck) {
if(!tab)
{
  return {
    isValid: false,
    msg: 'Tab not fully loaded. Please try again...'
  };
}

  if (tab.url.includes(C.WEBSITE_DETAILS.LOGIN) && !loggedOutCheck) {
    console.debug('Invalid host:', tab.url);
    return {
      isValid: false,
      msg: 'Login Page Detected: Please login and retry.'
    };
  }

  if (!tab.title.includes(C.WEBSITE_DETAILS.TITLE)) {
    console.debug('Invalid title:', tab.title);
    return {
      isValid: false,
      msg: `This extension can only be activated on a site with the title ${C.WEBSITE_DETAILS.TITLE}`
    };
  }

  if (!tab.url.includes(C.WEBSITE_DETAILS.HOST)) {
    console.debug('Invalid host:', tab.url);

    return {
      isValid: false,
      msg: `This extension can only be activated on a site hosted on ${C.WEBSITE_DETAILS.HOST}`
    };
  }

  return {
    isValid: true,
    msg: 'Site is valid.'
  };
  
}






function showAlert(tabID, tabURL, message) {
  if (tabURL?.startsWith("chrome://")) return;

  chrome.scripting.executeScript({
    target: {
      tabId: tabID
    },
    func: (alertMessage) => alert(alertMessage),
    args: [message],
  });
}

function resetState() {
  STATE.running = false;
  STATE.tab = null;
  STATE.pswd=null;
  STATE.checkServerInterval = null;
  STATE.retrievingMessageFromServer = null;
  chrome.action.setIcon(offIcon);
  stopServerCheck()

}

function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message)
    .then(response => {})
    .catch(error => {});
}




async function retrieveMessageFromServer() {
  if (!STATE.corrlinks_account) return;

  // First, send queued messages if available (Robust and feasible: as rarely msgs will be queued - So minor delay...)
  if (STATE.messageQueue.length > 0) {
    const queuedMessage = STATE.messageQueue.shift();
    sendNewMessageNotification(queuedMessage);
    return;
  }

  const fn = 'retrieveMessageFromServer:';
  STATE.retrievingMessageFromServer = new Date();
  const url = C.SERVER.GET_NEXT_MESSAGE + '?corrlinks_account=' + STATE.corrlinks_account;
  const config = {
    method: 'GET',
    headers: {
      "Content-Type": "application/json"
    },
  };

  try {
    let r = await fetch(url, config);
    STATE.retrievingMessageFromServer = false;
    if (r.status === 204) {
      console.log(fn, 'No messages to retrieve.');
      return;
    }
    if (!r.ok) {
      console.warn(fn, `HTTP error! Status: ${r.status}`);
      return null;
    }
    const data = await r.json();
    console.debug(fn, 'Retrieved a message', data);
    sendNewMessageNotification(data);
  } catch (e) {
    STATE.retrievingMessageFromServer = false;
    if (e.message === 'Failed to fetch') {
      console.warn(`Looks like the backend server is down. Please check.`);
    }
    console.error(fn, e);
  }
}


let serverPolling = false;

function startServerCheck() {
  if (!serverPolling) {
    serverPolling = true;
    console.log("Server polling started");

    clearInterval(STATE.checkServerInterval); // Ensure previous one's cleared
    STATE.checkServerInterval = null;
    STATE.checkServerInterval = setInterval(function() {
      const msg = {
        message: "POLLING_SERVER",
      };
      console.log("Polling the server...");
      setTimeout(() => {
        if (STATE.tab) sendMessageToTab(STATE.tab.id, msg);


      }, 5000);

      retrieveMessageFromServer();
    }, C.DEFAULTS.UPDATE_CONTENT_STATE_SECONDS * 1000);

  }
}

function stopServerCheck() {
  serverPolling = false;
  clearInterval(STATE.checkServerInterval);
  STATE.checkServerInterval = null;
  console.log("Server polling stopped");
}



function sendMessageDeliveryUpdateToServer(data, response) {
  const fn = 'sendMessageDeliveryUpdateToServer:';
  const url = C.SERVER.NOTIFY_DELIVERY_STATUS;
  const config = {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data),
  };

  console.debug(fn, {
    config
  });

  fetch(url, config)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log(fn, 'Response:', data);
    })
    .catch(error => {
      console.error(fn, 'Error occurred:', error);
    });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {


    sendResponse({
      state: STATE.running
    });
  }
  if (request.action === 'setState') {
    stop();
  }
  if (request.action === 'getEmailAddress') {
 	sendResponse({ email: requestCorrlinksEmail() });
  }
 if (request.action === 'getPswd') {
 	sendResponse({ pswd: requestCorrlinksPswd() });
  }
  if (request.action === "SET_CORRLINKS_ACCOUNT") {
    if (STATE.corrlinks_account !== null && STATE.corrlinks_account !== request.corrlinks_account) {
      STATE.messageQueue = []; // Clear the message queue
      console.log('Message queue cleared due to account change');
    }
    if(request.corrlinks_account)
    STATE.corrlinks_account = request.corrlinks_account;
    console.log('STATE.corrlinks_account set to ' + STATE.corrlinks_account);
    if(request.password)
    STATE.pswd=request.password
  }


  if (request.type === 'MESSAGE_DELIVERED') {
    const uniqueID = request.id;
    if (!uniqueID) return
    sendMessageDeliveryUpdateToServer({
      id: uniqueID,
      status: "MESSAGE_DELIVERED"
    });
  }
  if (request.type === 'MESSAGE_COULD_NOT_BE_DELIVERED') {
    const uniqueID = request.id;
    if (!uniqueID) return
    sendMessageDeliveryUpdateToServer({
      id: uniqueID,
      status: "MESSAGE_COULD_NOT_BE_DELIVERED"
    });
  }
  if (request.type === 'USER_NOT_FOUND_IN_CORRLINKS') {
    const uniqueID = request.id;
    if (!uniqueID) return

    sendMessageDeliveryUpdateToServer({
      id: uniqueID,
      status: "USER_NOT_FOUND_IN_CORRLINKS"
    });
  }

  if (request.action === 'ADD_MSG_TO_QUEUE') {

    const newMessageId = request.message.data.message.id;
    if (!newMessageId) return
    let exists = false;
    for (let i = 0; i < STATE.messageQueue.length; i++) {

      const existingMessage = STATE.messageQueue[i];
      if (existingMessage.data.message.id === newMessageId) { //Duplicate check... 
        exists = true;
        break;
      }
    }
    if (!exists)
      STATE.messageQueue.push(request.message); // Enqueue the new message

  }

});




chrome.tabs.onRemoved.addListener((tabId) => {
  if (STATE.tab && STATE.tab.id === tabId) {
    resetState();
    console.debug('Tab closed, reset state.');
  }
});

chrome.tabs.onUpdated.addListener((updatedTabId, changeInfo, tab) => {
  if (STATE.tab && STATE.tab.id === updatedTabId) {
    if (changeInfo.status === 'complete') {
      STATE.tab = tab;
      setTimeout(() => {
        const result = isValidSite(STATE.tab, true);
        if (result && !result.isValid) {
          console.log("User navigated to some other website. Aborting...")
          stop();
          return;
        }

      }, 1000);

    }
  }
});








