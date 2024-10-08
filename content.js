const STATE = {
    stopNow: false,
    currentMessage: null
};

window.onload = () => {
    startUp()
    requestState()

};

async function startUp(reload) {
    const fn = 'startUp:';
    STATE.stopNow = false;
    try {
        const corrlinks_account = await getCorrlinksAccount();

        if (corrlinks_account) {
            sendMessage({
                action: "SET_CORRLINKS_ACCOUNT",
                corrlinks_account
            });


        }
        navigate();
        checkPending()
    } catch (error) {
        return;
    }


}

function checkPending() {
    const storedMessage = localStorage.getItem('MsgBeforeNavigate');
    if (storedMessage && isComposePage()) {
        STATE.currentMessage = storedMessage;
        const messageData = JSON.parse(storedMessage);
        openList();


        clickItem(messageData.id)
            .then((message) => {
                console.log(message); // USER FOUND IN CORRLINKS
                fillSubject(messageData.subject);
                fillMessage(messageData.message);
                validateMessage();
                localStorage.removeItem('MsgBeforeNavigate');
                STATE.currentMessage = null;
                navigate()



            })
            .catch((error) => {


                sendMessage({
                    type: "USER_NOT_FOUND_IN_CORRLINKS",
                    id: messageData.id
                });
                STATE.currentMessage = null;
                localStorage.removeItem('MsgBeforeNavigate');
                navigate(true) //User was not found let the backend know about it and navigate to the compose page

            });


    }
}

function isComposePage() {
    return (window.location.href.includes("https://www.corrlinks.com/en-US/mailbox/compose"))
}

function requestState() {

    chrome.runtime.sendMessage({
        action: 'getState'
    }, (response) => {
        if (response && response.state) {
            const currentState = response.state;

            if (currentState) {

                startUp(true);
                checkPending()

            }
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

function sendMessage(message) {
    chrome.runtime.sendMessage(null, message);
}
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
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    switch (request.message) {
        case "CHECK_PAGE_TYPE":
            hasLoggedOut();
            return;

        case "START_INTEGRATION":
            startUp();
            return;

        case "STOP_INTEGRATION":
            STATE.stopNow = true;
            window.location.href = window.location.href //Reload 
            return;

        case "NEW_MESSAGE_FROM_WHATSAPP":
            processMessage(request.data);
            return;

    }
});




function processMessage(message) {
    if (STATE.currentMessage) {
        console.log('Another message is in queue. Will retry sending message shortly...');
        addMessagetoQueue(message)
        return;
    }
    const pageType = getPageType();
    if (pageType === "NEW_MESSAGE") {
        STATE.currentMessage = message;
        let data = message.data.message //Unsure yet the server runs out of messages before I can test. Only this line needs to be checked
        console.log(data)

        if (!data) return
        let id = null,
            subject = null,
            body = null
        id = data.corrlinks_id;
        subject = data.subject;
        messagebody = data.body;
        msgID = data.id;
        if (id && subject && messagebody && msgID) {

            setTimeout(() => {
                openList();
                clickItem(id)
                    .then((result) => {
                        fillSubject(subject);
                        fillMessage(messagebody);
                        validateMessage();
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
        localStorage.setItem('MsgBeforeNavigate', JSON.stringify(message));
        navigate() // This will navigate to the Compose message page and try to send from there...
    }
}




function isLoginPage() {
    const targetUrls = [
        'https://www.corrlinks.com/en-US/login',
        'https://www.corrlinks.com/es-US/login'
    ];

    return targetUrls.some(url => window.location.href === url);
}

function hasLoggedOut() { // This fn sends a message to BG script to ABORT if the user is logged out... 

    if (isLoginPage()) {
        setState();
        STATE.stopNow = true;
    }
}

function navigate(bypass) { // To compose message page
    if (window.location.href !== "https://www.corrlinks.com/en-US/mailbox/compose") {
        window.location.href = "https://www.corrlinks.com/en-US/mailbox/compose";
    } else if (bypass) {
        window.location.href = "https://www.corrlinks.com/en-US/mailbox/compose";

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

function clickItem(id) {

    const Main = document.querySelector('.e-multi-select-list-wrapper');
    if (!Main) return

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
    unCheckAll(); //Uncheck any existing Item before clicking the one that matches ID...

    listItems.forEach((item) => {
        const nameSpan = item.querySelectorAll('.recipient-item-desktop')[0]; //ID is contained in the First span of each Item
        const match = nameSpan && nameSpan.textContent.match(/\((\d+)\)/);
        if (match && match[1] === id) {

            const checkboxWrapper = item.closest("li");
            if (checkboxWrapper) //Somehow this works here but not simulateClick or native .click()
            {


            }
        }
    });

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

function openList() {
    const Main = document.querySelector('[formcontrolname="contacts"]');
    if (Main) {

        let downIcon = Main.querySelector('.e-down-icon');
        if (downIcon) {
            simulateClick(downIcon);

        }
    }
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

    // Dispatch mousedown, mouseup, and click events
    element.dispatchEvent(mouseDownEvent);

    setTimeout(() => {
        element.dispatchEvent(mouseUpEvent);
        if (!nofocus)
            element.focus(); // Optionally remove ng-untouched or trigger other behavior


    }, 100);
}


function isMessageSentSuccessfully() {
    const element = Array.from(document.querySelectorAll('div')).find(div => div.textContent.trim() === 'Message successfully sent.');
    return element !== undefined;
}



function successfullySent() {
    if (isComposePage() && isMessageSentSuccessfully()) {
        return true
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


function specialClick(element)
{
        if(!element) return
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
