var isMaterial = Framework7.prototype.device.ios === false;
var isIos = Framework7.prototype.device.ios === true;

var CMID = "Test"; // Cross Manifold ID. TODO get from login
var pubnubUpdateChannel = "CM_Update_" + CMID; // This channel is for updates from the Pi that will be displayed on the app.
var pubnubCommandChannel = "CM_Command_" + CMID; // This channel is for commands from the app to the Pi.
                                                 // The Pi will read from this channel and adjust the thermostats accordingly.

var index = 1;

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

// Handle Cordova Device Ready Event
$$(document).on('deviceready', function() {
    console.log("Device is ready!");
    mainView.router.load({
      template: myApp.templates.login
    })
});

/*
* NAVIGATION
*/
$$(document).on('click', '.navbar .settings-button', function() {
  // var settings = JSON.parse(localStorage.getItem('settings')); // TODO
  mainView.router.load({
    template: myApp.templates.settings,
    animatePages:true
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
$$(".login-button").click(function( event ) {
  pubnubLogin();
})

// TODO
$$(".apply-button").click(function( event ) {
  pubnubPublishCommand();
})
