/** Registeration and Login
  */
var express = require('express');
var router = express.Router();
var passport = require('passport');

// GET login page
router.get('/login', function(req, res) {
  if (req.user) {
    // already logged in
    //res.render('login', { message: "You're already logged in as " + req.user.username });
    return res.redirect('/');
  } else {
    return res.render('auth/login');
  }
}); 

// POST login
router.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));


// GET registration page
router.get('/register', function(req, res) {
  res.render('auth/register');
});


var pendingActivationList = {};
var sha1 = require('sha1');

var emailbot = require('../emailbot');

var db = require('../db');
var models = db.models;

var base_url = "http://localhost:3000/"
var verify_url = "activate/";
var who_was = "whowas/";

var activation_timeout = 1000 * 60 * 60; // 1 hour

/** GET Activate account */
router.get('/activate/:sha', function(req, res) {
  var sha = req.params.sha;
  var obj = pendingActivationList[sha];

  if (obj) {
    if (Date.now() < (obj.date + activation_timeout || (1000*60*60)) ) {
      res.render('auth/template', {
        title: 'Account Activated!',
        p: [
          { text: 'Hi ' + (obj.req.body.username || 'Unkown') +
                "! You've successfully activated your account!" }
        ]
      });
      res.end();
    } else {
      res.render('auth/template', {
        title: 'Activation Time Expired!',
        p: [
          { text: 'Hi ' + (obj.req.body.username || 'Unkown') +
                "! The time to register your email has run out. Please try again." }
        ]
      });
      res.end();
    }
  } else {
    res.status(404).end(); // not found
  }
});

/** GET Find out who sent the registration */
router.get('/whowas/:sha', function(req, res) {
  var sha = req.params.sha;
  var obj = pendingActivationList[sha];

  if (obj) {
    // send information about the registartion attempt
    res.render('auth/template', {
      title: 'Who was',
      p: [
        {text: "json: " + obj}
      ]
    });
    res.end();
  } else {
    res.status(404).end(); // not found
  }
});

// POST registration
router.post('/register', function(req, res) {
  var json = req.body;

  console.log('In /register of account.js');
  console.log("json: " + JSON.stringify(json));

  models.User.findOne({ username: json.username }, function (err, user) {
    if (err) {
      console.log('Registration error: ' + err);
      return res.status(500).end();
    }
    if (!user) { // username available
      models.User.findOne({ email: json.email }, function (err, email) {
        if (err) {
          console.log('Registration error: ' + err);
          return res.status(500).end();
        }
        if (!email) { // email available

          /**  Create a new temporary user awaiting email verification.
            */
          var sha = sha1(json.username + Date.now() + "buffclouds"); // create sha out of request object

          // save the full request temporarily 
          pendingActivationList[sha] = {
            req: req,
            date: Date.now()
          }


          /** Send email */
          var app = require('../app');
          var opts = {
            name: json.username,
            title: "Buffclouds account activation.",
            activate_link: base_url + verify_url + sha,
            whois_link: base_url + who_was + sha
          };
          app.render('emails/verify', opts, function(err, html) {
            if (err) {
              console.log("Email error: Couldn't RENDER email verification mail: " + err);
              return res.status(500).end();
            }

            var mail = {
              to: 'talmo.christian@gmail.com',
              html: html,
              text: html
            }

            emailbot.sendMail(mail, function(err, info) {
              if (err) {
                console.log("Email error: Couldn't SEND email verification mail: " + err);
                return res.status(500).end();
              }

              res.render('auth/pleaseVerifyEmail', { title: "Success! Email sent!", name: json.username, email: json.email } );
              res.end();

              console.log("Email verification sent: " + info.response);
            });
          });

        } else { // email already taken
          return res.json({ type: 'error', message: "That email has already been registered." });
        }
      });
    } else { // username taken
      return res.json({ type: 'error', message: "That name isn't available." });
    }
  });
});


module.exports = router;