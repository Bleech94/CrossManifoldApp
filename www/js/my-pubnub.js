var lastUpdateJSON;

/*
* Functions
*/
// "Logging in" is just subscribing to an active Pubnub channel. Each Pi automatically connects to a unique channel.
// When the Pi starts it immediately sends an update. A phone can connect to any channel that has received an update.
function pubnubLogin() {
  console.log("Attempting to login...");

  // Get CMID from input fields and set channel names.
  CMID = $$('#CMID-input1').val() + $$('#CMID-input2').val() + $$('#CMID-input3').val() + $$('#CMID-input4').val();
  pubnubUpdateChannel = "CM_Update_" + CMID;
  pubnubCommandChannel = "CM_Command_" + CMID;

  // Check if history is empty. If it is, alert() steps to try and fix it, otherwise login to main page.
  pubnub.history({
    channel: pubnubUpdateChannel,
    count: 1,
    callback: function(m){
        lastUpdateJSON = m[0][0]; // m[0] is a message array, m[0][0] is the single message we requested as a JSON object.
        console.log(JSON.stringify(lastUpdateJSON));
        if(lastUpdateJSON) { // If there is any history in pubnubUpdateChannel this value is true.
          pubnubSubscribeToUpdates();
          mainView.router.load({
            template: myApp.templates.main,
            animatePages:true,
            context: lastUpdateJSON,
            reload: true
          });
        } else {
          alert("The Cross Manifold ID you entered did not match any active Cross Manifolds. Please try again."); // TODO: Add more information.
          // TODO: Do we want this?
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
      lastUpdateJSON = m; // m is the message we received.
      console.log(JSON.stringify(lastUpdateJSON));
      mainView.router.load({
        template: myApp.templates.main,
        animatePages:false,
        context: lastUpdateJSON,
        reload:true
      });
    },
    connect: function(m) {console.log("Connected: " + m)},
    disconnect: function(m) {
      console.log("Disconnected: " + m);
    },
    reconnect: function(m) {console.log("Reconnected: " + m)},
    error: function(m) {console.log("Network Error: " + m[0] + ' ' + m[1])},
    restore: true
  })
}

function pubnubPublishCommand(tempArray) {
  // Publish the array of desired temperatures selected to the channel that the Pi is subscribed to.
  pubnub.publish({
    channel: pubnubCommandChannel,
    message: tempArray,
    callback: function(m){
        console.log(m)
    }
  })
}

// This function is only used when Apply is pressed. It keeps the app and Pi sync'd.
// Without this you can Apply, restart the app and your changes will not be shown (but the Pi will have received them).
function pubnubPublishUpdate(currentArray, desiredArray) {
  var thermostatReadingArray = [];
  console.log(currentArray.length);
  // Loop through the current and desired temps for each thermostat, construct reading objects and push them to an array
  for(var i = 0; i < currentArray.length; i++) {
    var reading = {
      "current": currentArray[i],
      "desired": desiredArray[i]
    }
    thermostatReadingArray.push(reading);
  }
  var newUpdateJSON = {"thermostatReading":thermostatReadingArray}
  lastUpdateJSON = newUpdateJSON;

  pubnub.publish({
    channel: pubnubUpdateChannel,
    message: newUpdateJSON,
    callback: function(m){
        console.log(m)
    }
  })
}
