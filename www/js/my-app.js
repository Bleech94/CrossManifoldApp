var isMaterial = Framework7.prototype.device.ios === false;
var isIos = Framework7.prototype.device.ios === true;

var CMID = "Test"; // Cross Manifold ID. TODO get from login
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

// Rearrange some div classes to match android and iOS
if (!isIos) {
    $$('.pages.navbar-through').removeClass('navbar-through').addClass('navbar-fixed'); // Change class
    $$('.view .navbar').prependTo('.view .page'); // And move Navbar into Page
}

// Initialize app
var myApp = new Framework7({
    material: isMaterial ? true : false,
    precompileTemplates: true,
    template7Pages: true
});

// Add view
var mainView = myApp.addView('.view-main', {
    // Because we want to use dynamic navbar, we need to enable it for this view:
    dynamicNavbar: true,
    domCche: true
});

// TODO: Switch back to 'deviceready' event after testing
// Handle Cordova Device Ready Event
/*$$(document).on('deviceready', function() {
    console.log("Device is ready!");
    mainView.router.load({
      template: myApp.templates.login
    })
});*/

/* TODO: remove after testing */
if (navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry)/)) {
    document.addEventListener("deviceready", onDeviceReady, false);
} else {
    onDeviceReady();
}

function onDeviceReady() {
  console.log("Device is ready!");
}
/* remove after testing */


/*
* NAVIGATION
*/
$$(document).on('click', '.navbar .settings-button', function() {
  // var settings = JSON.parse(localStorage.getItem('settings')); // TODO
  index = 1;
  mainView.router.load({
    template: myApp.templates.settings,
    animatePages:true,
    context:lastUpdateJSON
  });
});

$$(document).on('click', '.logout-button', function() {
  mainView.router.load({
    template: myApp.templates.login
  })
  CMID = "";
  pubnubUpdateChannel = ""; // TODO: Need to reset channel names?
  pubnubCommndChannel = "";
})

/*
* CONTROL
*/
$$(document).on('click', '.increment', function() {
  var val = parseInt($$(this).prev().text().replace("°", "")) + 1;
  $$(this).prev().text(val + '°');
})

$$(document).on('click', '.decrement', function() {
  var val = parseInt($$(this).next().text().replace("°", "")) - 1;
  $$(this).next().text(val + '°');
})

// Auto switch input box when full.
$$(".CMID-input").keyup(function() {
  console.log($$(this).val().length);
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



/*
* PUBNUB
*/
// TODO: Ensure this is only ever called once? Just need to make a global bool.
var pubnub = PUBNUB.init({
    publish_key: 'pub-c-3082c989-10c9-4690-b759-2b7f56c733e7',
    subscribe_key: 'sub-c-88a5713a-8040-11e6-920d-02ee2ddab7fe',
    error: function (error) {
      console.log('Error: ' + error);
    }
})

// Check if the channel is live by checking the update history.
// If the Pi has ever sent an update to the channel that corresponds to the CMID then the user can "login" to this channel.
$$(document).on('click', '.login-button', function() {
  console.log("Login clicked");
  index=1;
  pubnubLogin();
})

// TODO
$$(document).on('click', '.apply-button', function() {
  console.log("Apply clicked.");

  // Loop through all desired temps and push a the cleaned numbers to an array.
  var desiredTempArray = [];
  $$(".desired-temp").each(function() {
      desiredTempArray.push(parseInt($$(this).text().replace("°", "")));
  });

  pubnubPublishCommand(desiredTempArray);
  alert("Desired Temperatures Updated.");
})
