# Corrlinks Chrome Extension 2 (Sender)

Using the extension

## Starting:

The extension should only be started when you have logged into Corrlinks. It will then redirect you to the Compose message page to start its working.

If you try to start it on any other website/login page/special pages, it will display an alert and not proceed further.

To start it, click its Icon in the browser Extensions button. 

The icon will indicate the extension's status.


NOTE: Please avoid running both extensions in the same tab. For example, if the Receiver extension is already activated on Tab 2, please make sure that the Sender extension is activated on a different tab. Running both extensions in the same tab will cause them to interfere with each other, preventing either from functioning properly.


## Working in a Nutshell

The extension works by polling the backend server. When it receives a message, it sends it to the Corrlinks website, where the content script operates—only if the user is on the Compose Message page. The message will be enqueued and retried during the next polling cycle if the user is not on that page. The same behavior applies if another message is already being processed, theoretically ensuring no messages are lost.

Once the user logs out and re-logs in with a different Corrlinks account, any enqueued messages will be cleared, so that’s something to keep in mind.

The extension also notifies the backend of successful sending and failure. 


## Stopping Extension:

To stop an extension, click the same button again or close the tab (Reloading the tab will not stop the Extension)


## Automatic Termination:
When the closes the tab/navigates to some other website, it will automatically HALT itself in the next cycle.
Similarly, it'll stop polling the server when the user navigates to any website other than Corrlinks.


##Automatic Login:
When the user logs out or is logged out by the Corrlinks website, the extension will automatically log in. It does this by requesting the password when the extension is initiated after logging into Corrlinks. The email is already automatically fetched by the extension.
