/*
* Functions
*/
// Subscribe to Updates channel. The Pi will send current and desired thermostat readings to this channel regularly.
function pubnubSubscribeToUpdates() {
  pubnub.subscribe({
    channel: pubnubUpdateChannel,
    message: function(m) {
      console.log("Message received: " + JSON.stringify(m)) // TODO update current thermostat readings on main page when message recieved
    },
    connect: function(m) {console.log("Connected: " + m)},
    disconnect: function(m) {
      console.log("Disconnected: " + m);
      pubnubSubscribeToUpdates(); // TODO remove this?
      console.log("Resubscribed.");
    },
    reconnect: function(m) {console.log("Reconnected: " + m)},
    error: function(m) {console.log("Network Error: " + m[0] + ' ' + m[1])},
    restore: true
  })
}

function pubnubPublishCommand(tempArray) {
  pubnub.publish({
    channel: pubnubCommandChannel,
    message: tempArray,
    callback: function(m){
        console.log(m)
    }
  })
}

// TODO: Fix this function. If there is no history, don't allow login. If there is some history then login is okay.
// Should return true or false
function pubnubLogin() {
  console.log("Attempting to login...");

  // Update CMID and channel info.
  if($$('#CMID-input').val()) { // TODO: Remove this if when done testing.
    CMID = $$('#CMID-input').val();
  }

  console.log(CMID);
  pubnubUpdateChannel = "CM_Update_" + CMID;
  pubnubCommandChannel = "CM_Command_" + CMID;

  // Check if history is empty. If it is, alert() steps to try and fix it, otherwise login to main page.
  pubnub.history({
    channel: pubnubUpdateChannel,
    callback: function(m){
        var lastUpdateJSON = m[0][0]; // m[0] is a message array, m[0][0] is the only message we requested as a JSON object.
        console.log(JSON.stringify(lastUpdateJSON));
        if(lastUpdateJSON) { // If there is any history in pubnubUpdateChannel this value is true.
          pubnubSubscribeToUpdates();
          mainView.router.load({
            template: myApp.templates.main,
            animatePages:true,
            context: lastUpdateJSON
          });
        } else {
          alert("Invalid CMID."); // TODO: Add more information.
        }
    },
    count: 1
  });
}
