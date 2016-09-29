var isMaterial = Framework7.prototype.device.ios === false;
var isIos = Framework7.prototype.device.ios === true;

var CMID = "Test"; // Cross Manifold ID. TODO get from login
var pubnubUpdateChannel = "CM_Update_" + CMID; // This channel is for updates from the Pi that will be displayed on the app.
var pubnubCommandChannel = "CM_Command_" + CMID; // This channel is for commands from the app to the Pi.
                                                 // The Pi will read from this channel and adjust the thermostats accordingly.

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
    dynamicNavbar: true
});

// Handle Cordova Device Ready Event
$$(document).on('deviceready', function() {
    console.log("Device is ready!");
});

/*
* Begin Navigation
*/
$$(document).on('click', '.page .login-link', function() {
  mainView.router.load({
    template: myApp.templates.main,
    animatePages:true,
    context: {
      // TODO: desiredTemps should be read from last message sent to the 'update' pubnub channel.
      desiredTemp1: 73,
      desiredTemp2: 75,
      desiredTemp3: 71,
      desiredTemp4: 85,
      desiredTemp5: 80,
      desiredTemp6: 76
    }
  });
});

$$(document).on('click', '.navbar .settings-link', function() {
  // var settings = JSON.parse(localStorage.getItem('settings')); // TODO
  mainView.router.load({
    template: myApp.templates.settings,
    animatePages:true
  });
});

/*
* BEGIN PUBNUB STUFF
*/

// TODO: Ensure this is only ever called once?
var pubnub = PUBNUB.init({
    publish_key: 'pub-c-3082c989-10c9-4690-b759-2b7f56c733e7',
    subscribe_key: 'sub-c-88a5713a-8040-11e6-920d-02ee2ddab7fe',
    error: function (error) {
      console.log('Error: ' + error);
    }
})

// Check if the channel is live by checking the update history.
// If the Pi has ever sent an update to the channel that corresponds to the CMID then the user can "login" to this channel.
// TODO: Use an if/else to either accept login and move to main page or decline.
$$("form.login-link").click(function( event ) {
  pubnubLogin();
})

$$("form.apply-link").click(function( event ) {
  pubnubPublishCommand();
})

pubnubSubscribeToUpdates(); // TODO: Put inside login?
