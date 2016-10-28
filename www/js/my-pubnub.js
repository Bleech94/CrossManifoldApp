var lastUpdateJSON;
var haveArraysChanged = []; // Array of bools for each message parameter to determine which arrays have been updated.

/*
* Functions
*/

// Compare JSON of 2 objects/arrays
function isJSONEqual(a1,a2) {
    /* WARNING: arrays must not contain {objects} or behavior may be undefined */
    // TODO: fix for objects? Should work as long as the order of data doesn't change.
    return JSON.stringify(a1)==JSON.stringify(a2);
}

// Determine which arrays have changed in the update
function getChanges(msg) {
  /*
  console.log("nameArray is changed: " + !isJSONEqual(nameArray, msg.names));
  console.log("currentTemps is changed: " + !isJSONEqual(currentTempArray, msg.currentTemps));
  console.log("desiredTempArray is changed: " + !isJSONEqual(desiredTempArray, msg.desiredTemps));
  console.log("modeArray is changed: " + !isJSONEqual(modeArray, msg.modes));
  console.log("scheduleNameArray is changed: " + !isJSONEqual(scheduleNameArray, msg.scheduleNames));
  console.log("scheduleArray is changed: " + !isJSONEqual(scheduleArray, msg.schedules));
  */

  // TODO: Use these to determine which pages will need to refresh.
  haveArraysChanged = [
    !isJSONEqual(nameArray, msg.names),
    !isJSONEqual(currentTempArray, msg.currentTemps),
    !isJSONEqual(desiredTempArray, msg.desiredTemps),
    !isJSONEqual(modeArray, msg.modes),
    !isJSONEqual(scheduleNameArray, msg.scheduleNames),
    !isJSONEqual(scheduleArray, msg.schedules)
  ]
  console.log("have arrays changed? - " + haveArraysChanged);
}

// Read a message from the update channel and store its contents.
function parseMessage(msg) {
  nameArray = msg.names;
  currentTempArray = msg.currentTemps;
  desiredTempArray = msg.desiredTemps;
  modeArray = msg.modes;
  scheduleNameArray = msg.scheduleNames;
  scheduleArray = msg.schedules;

  console.log("nameArray: " + nameArray);
  console.log("currentTempArray: " + currentTempArray);
  console.log("desiredTempArray: " + desiredTempArray);
  console.log("modeArray: " + modeArray);
  console.log("scheduleNameArray: " + scheduleNameArray);
  console.log("scheduleArray[0] name: " + scheduleArray[0].name + ", first day in first group: " + scheduleArray[0].groups[0].days[0] + ", first time and temp on that day: " + scheduleArray[0].groups[0].pairs[0].time + ", " + scheduleArray[0].groups[0].pairs[0].temp);
}

// "Logging in" is just subscribing to an active Pubnub channel. Each Pi automatically connects to a unique channel.
// When the Pi starts it immediately sends an update. A phone can connect to any channel that has received an update.
function pubnubLogin() {
  // Get CMID from input fields and set channel names.
  CMID = $$('#CMID-input1').val() + $$('#CMID-input2').val() + $$('#CMID-input3').val() + $$('#CMID-input4').val();
  pubnubUpdateChannel = "CM_Update_" + CMID;

  // Check if history is empty. If it is, alert() steps to try and fix it, otherwise login to main page.
  pubnub.history({
    channel: pubnubUpdateChannel,
    count: 1,
    callback: function(m){
        // m[0] is a message array, m[0][0] is the single message we requested as a JSON object.
        if(m[0][0]) { // If there is any history in pubnubUpdateChannel this value is true.
          parseMessage(m[0][0]);
          pubnubSubscribeToUpdates();
          loadMainTemplate(true, true);
        } else {
          alert("The Cross Manifold ID you entered did not match any active Cross Manifolds. Please try again."); // TODO: Add more information.
          $$('#CMID-input1').val("");
          $$('#CMID-input2').val("");
          $$('#CMID-input3').val("");
          $$('#CMID-input4').val("");
          $$('#CMID-input1').focus();
        }
    }
  });
}

// Subscribe to Updates channel. The Pi will send current and desired thermostat readings to this channel regularly.
function pubnubSubscribeToUpdates() {
  pubnub.subscribe({
    channel: pubnubUpdateChannel,
    message: function(m) {
      getChanges(m);
      parseMessage(m);
      refreshPage();
    },
    connect: function(m) {console.log("Connected: " + m)},
    disconnect: function(m) {console.log("Disconnected: " + m)},
    reconnect: function(m) {console.log("Reconnected: " + m)},
    error: function(m) {console.log("Network Error: " + m[0] + ' ' + m[1])},
    restore: true
  })
}

// This function is only used when Apply is pressed. It keeps all devices sync'd.
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
