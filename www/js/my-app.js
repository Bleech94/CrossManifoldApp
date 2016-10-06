/*
* INITIALIZE
*/
var isMaterial = Framework7.prototype.device.ios === false;
var isIos = Framework7.prototype.device.ios === true;

var CMID = ""; // Cross Manifold ID.
var pubnubUpdateChannel = "CM_Update_" + CMID; // This channel is for updates from the Pi that will be displayed on the app.
var pubnubCommandChannel = "CM_Command_" + CMID; // This channel is for commands from the app to the Pi to change the thermostats.

var index = 1;
var zoneNameArray = [];

// Accessible anywhere.
Template7.global = {
    material: isMaterial,
    ios: isIos
};

var $$ = Dom7; // Custom DOM library, almost the exact same as jQuery

// Rearrange some div classes to match android and iOS. TODO: Check if working.
if (!isIos) {
    $$('.pages.navbar-through').removeClass('navbar-through').addClass('navbar-fixed'); // Change class
    $$('.view .navbar').prependTo('.view .page'); // And move Navbar into Page
}

// Initialize app
var myApp = new Framework7({
    material: isMaterial ? true : false,
    precompileTemplates: true,
    template7Pages: true // TODO: Is this used?
});

// Add view
var mainView = myApp.addView('.view-main', {
    // Because we want to use dynamic navbar, we need to enable it for this view:
    dynamicNavbar: true,
    domCache: true // TODO: Is this used?
});

// TODO: Switch back to 'deviceready' event after testing
// Handle Cordova Device Ready Event
/*$$(document).on('deviceready', function() {
    console.log("Device is ready!");
});*/

/* TODO: remove after testing */
if (navigator.userAgent.match(/(iPhone|Android)/)) {
    document.addEventListener("deviceready", onDeviceReady, false);
} else {
    onDeviceReady();
}

function onDeviceReady() {
  console.log("Device is ready!");
}
/* remove after testing */

// Initialize Pubnub TODO: Ensure this is only ever called once?
var pubnub = PUBNUB.init({
    publish_key: 'pub-c-3082c989-10c9-4690-b759-2b7f56c733e7',
    subscribe_key: 'sub-c-88a5713a-8040-11e6-920d-02ee2ddab7fe',
    error: function (error) {
      console.log('Error: ' + error);
    }
})



/*
* NAVIGATION
*/
// Login: Check if the channel is live by checking the update history. If there is a message than the corresponding Pi is active.
$$(document).on('click', '.login-button', function() {
  console.log("Login clicked");
  index=1;
  pubnubLogin();
})

// Settings
$$(document).on('click', '.navbar .settings-button', function() {
  // var settings = JSON.parse(localStorage.getItem('settings')); // TODO
  index = 1;
  mainView.router.load({
    template: myApp.templates.settings,
    animatePages:true,
    context:lastUpdateJSON,
    ignoreCache: true
  });
});

// Logout
$$(document).on('click', '.logout-button', function() {
  $$( ".current-temp, .desired-temp" ).remove();
  mainView.router.load({
    pageName: 'login'
  })
  CMID = "";
  pubnubUpdateChannel = ""; // TODO: Need to reset channel names?
  pubnubCommndChannel = "";
})



/*
* CONTROL
*/
// Send command to the Pi with the desired temperatures.
$$(document).on('click', '.apply-button', function() {
  console.log("Apply clicked.");

  // Loop through all desired temps and push the cleaned numbers to an array.
  var desiredTempArray = [];
  $$(".desired-temp").each(function() {
    desiredTempArray.push(parseInt($$(this).text().replace("°", "")));
  });

  pubnubPublishCommand(desiredTempArray);
  console.log("Command sent.");

  index = 1;

  // Loop through all desired temps and push the cleaned numbers to an array.
  var currentTempArray = [];
  $$(".current-temp").each(function() {
    console.log(".current-temp");
    currentTempArray.push(parseInt($$(this).text().replace("°", "")));
  });
  pubnubPublishUpdate(currentTempArray, desiredTempArray);
  console.log("Update sent.");
})

// Increment corresponding desired temperature.
$$(document).on('click', '.increment', function() {
  var val = parseInt($$(this).prev().text().replace("°", "")) + 1;
  $$(this).prev().text(val + '°');
})

// Decrement corresponding desired temperature.
$$(document).on('click', '.decrement', function() {
  var val = parseInt($$(this).next().text().replace("°", "")) - 1;
  $$(this).next().text(val + '°');
})

// Auto switch input box when full.
$$(".CMID-input").keyup(function() {
  if($$(this).val().length == 4) {
    $$(this).next().focus();
  }
})

// Attempt login when enter is pushed. TOOD: Change this for mobile? Does it need to be a form?
$$('.CMID-input').keydown(function (e){
    if(e.keyCode == 13){
        pubnubLogin();
    }
})
