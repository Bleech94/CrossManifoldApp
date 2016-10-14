var lastUpdateJSON;

/*
* Functions
*/
// Read a message from the update channel and store its contents.
function parseMessage(msg) {
  nameArray = msg.name;
  currentTempArray = msg.currentTemp;
  desiredTempArray = msg.desiredTemp;
  modeArray = msg.mode;
  scheduleNameArray = msg.scheduleName;
  scheduleArray = msg.schedule;

  console.log("nameArray: " + nameArray);
  console.log("currentTempArray: " + currentTempArray);
  console.log("desiredTempArray: " + desiredTempArray);
  console.log("modeArray: " + modeArray);
  console.log("scheduleNameArray: " + scheduleNameArray);
  console.log("scheduleArray[0] time on monday: " + scheduleArray[0].monday[0].time + ", temp on monday: " + scheduleArray[0].monday[0].temp);

}

// "Logging in" is just subscribing to an active Pubnub channel. Each Pi automatically connects to a unique channel.
// When the Pi starts it immediately sends an update. A phone can connect to any channel that has received an update.
function pubnubLogin() {
  console.log("Attempting to login...");

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
      parseMessage(m);
      loadMainTemplate(true, false);
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
    "name":nameArray,
    "currentTemp":currentTempArray,
    "desiredTemp":desiredTempArray,
    "mode":modeArray,
    "scheduleName":scheduleNameArray,
    "schedule":scheduleArray
  };

  pubnub.publish({
    channel: pubnubUpdateChannel,
    message: newUpdate,
    callback: function(m) {
        console.log(m)
    }
  })
}
