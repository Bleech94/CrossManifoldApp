var lastUpdateJSON;

/*
* Functions
*/
// TODO: Fix this function. If there is no history, don't allow login. If there is some history then login is okay.
// Should return true or false
function pubnubLogin() {
  console.log("Attempting to login...");

  // Update CMID and channel info.
  CMID = $$('#CMID-input1').val() + $$('#CMID-input2').val() + $$('#CMID-input3').val() + $$('#CMID-input4').val();

  console.log(CMID);
  pubnubUpdateChannel = "CM_Update_" + CMID;
  pubnubCommandChannel = "CM_Command_" + CMID;

  // Check if history is empty. If it is, alert() steps to try and fix it, otherwise login to main page.
  pubnub.history({
    channel: pubnubUpdateChannel,
    callback: function(m){
        lastUpdateJSON = m[0][0]; // m[0] is a message array, m[0][0] is the only message we requested as a JSON object.
        console.log(JSON.stringify(lastUpdateJSON));
        if(lastUpdateJSON) { // If there is any history in pubnubUpdateChannel this value is true.
          pubnubSubscribeToUpdates();
          mainView.router.load({
            template: myApp.templates.main,
            animatePages:true,
            context: lastUpdateJSON
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
    },
    count: 1
  });
}

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
