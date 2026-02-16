// Connect to the native host
let port = null;

function connect() {
    console.log("Connecting to native host...");
    port = chrome.runtime.connectNative('com.kitsune.dm');
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);
    console.log("Connected to Kitsune Native Host");
}

function onMessage(response) {
    console.log("Received: " + JSON.stringify(response));
}

function onDisconnect() {
    console.log("Disconnected");
    if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError.message);
    }
    // Optional: Auto-reconnect logic could go here
}

connect();

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "download-with-kitsune",
        title: "Download with Kitsune",
        contexts: ["link", "image", "video", "audio"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "download-with-kitsune") {
        const url = info.linkUrl || info.srcUrl;
        if (url) {
            console.log("Sending URL to Kitsune:", url);
            try {
                port.postMessage({ command: "AddDownload", url: url });
            } catch (e) {
                console.error("Failed to send message: " + e);
                console.log("Attempting to reconnect...");
                connect();
                setTimeout(() => {
                    port.postMessage({ command: "AddDownload", url: url });
                }, 100);
            }
        }
    }
});
