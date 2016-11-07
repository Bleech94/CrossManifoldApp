var haveArraysChanged = []; // Array of bools for each message parameter to determine which arrays have been updated.

/*
* Functions
*/
// Compare JSON of 2 objects/arrays
function isJSONEqual(a1,a2) {
    /* WARNING: arrays must not contain {objects} or behavior may be undefined */
    // TODO: fix for objects? Should work as long as the order of data doesn't change.
    return JSON.stringify(a1) == JSON.stringify(a2);
}

// Read a message from the update channel and store its contents.
function parseMessage(msg) {
    nameArray = msg.names;
    currentTempArray = msg.currentTemps;
    desiredTempArray = msg.desiredTemps;
    modeArray = msg.modes;
    scheduleNameArray = msg.scheduleNames;
    // If these arrays are equal then no schedules are currently being editted.
    if(isJSONEqual(scheduleArray, tempScheduleArray)) {
        tempScheduleArray = JSON.parse(JSON.stringify(msg.schedules));
    }
    scheduleArray = msg.schedules;
    /*
    console.log("nameArray: " + nameArray);
    console.log("currentTempArray: " + currentTempArray);
    console.log("desiredTempArray: " + desiredTempArray);
    console.log("modeArray: " + modeArray);
    console.log("scheduleNameArray: " + scheduleNameArray);
    console.log("scheduleArray[0] name: " + scheduleArray[0].name + ", first day in first group: " + scheduleArray[0].groups[0].days[0] + ", first time and temp on that day: " + scheduleArray[0].groups[0].pairs[0].time + ", " + scheduleArray[0].groups[0].pairs[0].temp);
    */
}

// Determine which arrays have changed in the update - used to determine when a page refresh is needed.
function getChanges(msg) {
    haveArraysChanged = [
        !isJSONEqual(nameArray, msg.names),
        !isJSONEqual(currentTempArray, msg.currentTemps),
        !isJSONEqual(desiredTempArray, msg.desiredTemps),
        !isJSONEqual(modeArray, msg.modes),
        !isJSONEqual(scheduleNameArray, msg.scheduleNames),
        !isJSONEqual(scheduleArray, msg.schedules) && isJSONEqual(scheduleArray, tempScheduleArray) // Have the arrays changed AND scheduleArray == temp? If not then we don't want to refresh the page.
    ]
    console.log("haveArraysChanged: " + haveArraysChanged);
}

// Check if any of the arrays used for the current page have changed.
function doesNeedRefresh() {
    for(var i = 0; i < haveArraysChanged.length; i++) {
        if(haveArraysChanged[i] && arraysUsedObj[currentPage][i]) {
            return true;
        }
    }
    return false;
}

// "Logging in" is just subscribing to an active Pubnub channel. Each Pi automatically connects to a unique channel.
// When the Pi starts it immediately sends an update. A phone can connect to any channel that has received an update.
// Check if a channel has recieved an update by grabbing the last message from history.
function pubnubLogin() {
    // Get CMID from input fields and set channel names.
    CMID = $$('#CMID-input1').val() + $$('#CMID-input2').val() + $$('#CMID-input3').val() + $$('#CMID-input4').val();
    pubnubUpdateChannel = "CM_Update_" + CMID;

    // Check if history is empty. If it is, alert() steps to try and fix it, otherwise login to main page.
    pubnub.history({
        channel: pubnubUpdateChannel,
        count: 1,
        callback: function(m) {
            // m[0] is a message array, m[0][0] is the single message we requested as a JSON object.
            if(m[0][0]) { // If there is any history in pubnubUpdateChannel this value is true.
                parseMessage(m[0][0]);
                tempScheduleArray = JSON.parse(JSON.stringify(scheduleArray));
                pubnubSubscribeToUpdates();
                loadMainTemplate(true, true);
            } else {
                myApp.alert("The Cross Manifold ID you entered did not match any active Cross Manifolds. Please try again.", "Invalid ID"); // TODO: Add more information.
                $$('#CMID-input1').val("");
                $$('#CMID-input2').val("");
                $$('#CMID-input3').val("");
                $$('#CMID-input4').val("");
                $$('#CMID-input1').focus();
            }
        },
        error: function(e) {
            myApp.alert("Unable to login.", "No Internet Connection") // TODO: Other potential errors?
        }
    });
}

// Subscribe to Updates channel. This channel keeps all connected devices in sync.
function pubnubSubscribeToUpdates() {
    pubnub.subscribe({
        channel: pubnubUpdateChannel,
        message: function(m) {
            getChanges(m);
            parseMessage(m);
            if(doesNeedRefresh()) {
                refreshPage();
            }
        },
        connect: function(m) {console.log("Connected: " + m)},
        disconnect: function(m) {console.log("Disconnected: " + m)},
        reconnect: function(m) {console.log("Reconnected: " + m)},
        error: function(m) {console.log("Network Error: " + m[0] + ' ' + m[1])},
        restore: true
    })
}

// Publish an update to the channel.
function pubnubPublishUpdate() {
    // Construct message
    var newUpdate = {
        "names":nameArray,
        "currentTemps":currentTempArray,
        "desiredTemps":desiredTempArray,
        "modes":modeArray,
        "scheduleNames":scheduleNameArray,
        "schedules":scheduleArray
    };

    pubnub.publish({
        channel: pubnubUpdateChannel,
        message: newUpdate,
        callback: function(m) {
            console.log("Message published.")
        }
    })
}
