/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

const 
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),  
  request = require('request');

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

var cart_payload = '';
var cart_quantity = 0;

var needle = require('needle');
// var menu = require('./menu.js');


/*
 * Be sure to setup your config values before running this code. You can 
 * set them using environment variables or modifying the config file in /config.
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ? 
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address. 
const SERVER_URL = (process.env.SERVER_URL) ?
  (process.env.SERVER_URL) :
  config.get('serverURL');

const GOOGLE_KEY = (process.env.GOOGLE_KEY) ?
  (process.env.GOOGLE_KEY) :
  config.get('googleAPIKey');

  console.log(GOOGLE_KEY);


if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL. 
 * 
 */
app.get('/authorize', function(req, res) {
  var accountLinkingToken = req.query.account_linking_token;
  var redirectURI = req.query.redirect_uri;

  // Authorization Code should be generated per user by the developer. This will 
  // be passed to the Account Linking callback.
  var authCode = "1234567890";

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('authorize', {
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
});




  // var data = {
  //   senderID: senderID,
  //   type: type,
  //   payload: payload
  // };

  // var options = {
  //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  // }

  // console.log(data);
   
  // needle.post('http://gpdigital.crabdance.com/api/v0/chatbot.php', data, options, function(err, resp, body) {
  //   if(!err){

  
  //   }
  //   else{
  //     console.log('needle error');
  //   }
  // });

  var GlobalMenu;
  // var link = 'http://gpdigital.crabdance.com/api/v0/delibot.php';
  // needle.get(link, function(error, response) {
  //     if (!error){
  //       // console.log(response.body);
  //       GlobalMenu = JSON.parse(response.body);
  //       console.log(GlobalMenu.category);
  //       console.log(GlobalMenu.category[0].item);
  //       console.log(GlobalMenu.category[0].item[0].variant);
  //     }
  //     else{
  //       console.log("error");
  //     }
  //   });


    var InitialData = {
      action: "get_menu"
    };

    var GlobalHeader = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    };
     
    needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', InitialData, GlobalHeader, function(err, resp, body) {
      if(!err){
        // console.log(resp.body);
        GlobalMenu = JSON.parse(resp.body);
        console.log(GlobalMenu.category);
        console.log(GlobalMenu.category[0].item);
        console.log(GlobalMenu.category[0].item[0].variant);
      }
      else{
        console.log('needle error');
      }
    });







/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the 'data-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the 
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger' 
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam, 
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  sendTextMessage(senderID, "Authentication successful");
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some 
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've 
 * created. If we receive a message with an attachment (image, video, audio), 
 * then we'll simply confirm that we've received the attachment.
 * 
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var senderName = event.sender.name;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s", 
      messageId, appId, metadata);
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s",
      messageId, quickReplyPayload);

    processPostback(quickReplyPayload, senderID, senderName, timeOfMessage);
    // sendTextMessage(senderID, "Quick reply tapped");
    return;
  }

  if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText) {
      case 'image':
        sendImageMessage(senderID);
        break;

      case 'gif':
        sendGifMessage(senderID);
        break;

      case 'audio':
        sendAudioMessage(senderID);
        break;

      case 'video':
        sendVideoMessage(senderID);
        break;

      case 'file':
        sendFileMessage(senderID);
        break;

      case 'button':
        sendButtonMessage(senderID);
        break;

      case 'generic':
        sendGenericMessage(senderID);
        break;

      case 'receipt':
        sendReceiptMessage(senderID);
        break;

      case 'quick reply':
        sendQuickReply(senderID);
        break;        

      case 'read receipt':
        sendReadReceipt(senderID);
        break;        

      case 'typing on':
        sendTypingOn(senderID);
        break;        

      case 'typing off':
        sendTypingOff(senderID);
        break;        

      case 'account linking':
        sendAccountLinking(senderID);
        break;

      default:
        var data = {
          action:         "check_state",
          MessengerId:    senderID,
          Building:       messageText
        };
        // console.log(data);

        needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', data, GlobalHeader, function(err, resp, body) {
          if(!err){
            console.log(resp.body);
            var stat = JSON.parse(resp.body);
            if(stat.status == 'ok'){
              // sendTextMessage(senderID, stat.address);
              buildReceipt(senderID, stat.address);
            }
            // sendTextMessage(senderID, "Building Info\u000A(Unit No./ Bldg. Name)");
          }
          else{
            console.log('needle error');
          }
        });

        // sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    console.log(messageAttachments);
    console.log(messageAttachments[0].payload.coordinates);
    // sendTextMessage(senderID, "Message with attachment received");
    var locationurl = 'https://maps.googleapis.com/maps/api/geocode/json?latlng='+messageAttachments[0].payload.coordinates.lat+','+messageAttachments[0].payload.coordinates.long+'&key='+GOOGLE_KEY;
    console.log(locationurl);
    needle.get(locationurl, function(error, response) {
      if (!error && response.statusCode == 200){

        console.log(response.body);
        // var result = JSON.parse(response.body);
        // console.log(result.results);
        var result = response.body.results;
        console.log(result);

        var text = '';
        var addr = []
        var loc = {
          address: ''
        };
        for(var i = 0; i <result[0].address_components.length; i++){
          if(result[0].address_components[i].types[0] == 'street_number'){
            loc.address = result[0].address_components[i].long_name;
          }
          if(result[0].address_components[i].types[0] == 'route'){
            loc.address = loc.address+" "+result[0].address_components[i].long_name;
          }
        }
        for(var i = 0; i <result[1].address_components.length; i++){
          if(result[1].address_components[i].types[0] == 'neighborhood'){
            loc.address = loc.address+", "+result[1].address_components[i].long_name;
          }
          if(result[1].address_components[i].types[0] == 'sub_locality'){
            loc.address = loc.address+", "+result[1].address_components[i].long_name;
          }
          if(result[1].address_components[i].types[0] == 'locality'){
            loc.address = loc.address+", "+result[1].address_components[i].long_name;
          }
          if(result[1].address_components[i].types[0] == 'administrative_area_level_1'){
            loc.address = loc.address+", "+result[1].address_components[i].long_name;
          }
          if(result[1].address_components[i].types[0] == 'country'){
            loc.address = loc.address+", "+result[1].address_components[i].long_name;
          }
        }

        var data = {
          action:         "add_address",
          MessengerId:    senderID,
          Address:        loc.address
        };
        // console.log(data);

        needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', data, GlobalHeader, function(err, resp, body) {
          if(!err){
            console.log(resp.body);
            sendTextMessage(senderID, "Building Info\u000A(Unit No./ Bldg. Name)");
          }
          else{
            console.log('needle error');
          }
        });

        // sendTextMessage(senderID, loc.address);
      }
        
    });

  }
}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s", 
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}



function generateText(senderID, text){
  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      text: text,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };
  return messageData;
}


function generateMenu(senderID){
  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: []
        }
      }
    }
  };

  for(var i = 0; i < GlobalMenu.category.length; i++){
    var temp_menu = {
      title:      GlobalMenu.category[i].title,
      image_url:  SERVER_URL + GlobalMenu.category[i].imageurl,
      buttons: [{
        type:     "postback",
        title:    "Show Items",
        payload:  "MENU_"+GlobalMenu.category[i].payload 
      }]
    };
    messageData.message.attachment.payload.elements.push(temp_menu);
  }

  return messageData;
}

function generateItem(senderID, category){
  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: []
        }
      }
    }
  };

  for(var i = 0; i < GlobalMenu.category.length; i++){
    if(GlobalMenu.category[i].payload == category){
      for(var j = 0; j < GlobalMenu.category[i].item.length; j++){
        // var temp_item_title;
        var temp_item_choice;
        var temp_item_payload;
        if(GlobalMenu.category[i].item[j].variant.length == 1){
          temp_item_choice = "Add to Cart(P"+GlobalMenu.category[i].item[j].variant[0].price+")";
          temp_item_payload = "MENU_"+GlobalMenu.category[i].item[j].variant[0].payload+"_ADD";
        }
        else if(GlobalMenu.category[i].item[j].variant.length > 1){
          temp_item_choice = "Select Variant";
          temp_item_payload = "MENU_"+GlobalMenu.category[i].item[j].payload;
        }
        else{
          temp_item_choice = "No Choice";
        }
        console.log(SERVER_URL + GlobalMenu.category[i].item[j].imageurl);
        var temp_item = {
          title:      GlobalMenu.category[i].item[j].title,
          subtitle:   GlobalMenu.category[i].item[j].description,
          image_url:  SERVER_URL + GlobalMenu.category[i].item[j].imageurl,
          buttons: [{
            type:     "postback",
            title:    temp_item_choice,
            payload:  temp_item_payload
          }, {
            type:     "postback",
            title:    "Back to categories",
            payload:  "MAIN_VIEWMENU"
          }, {
            type:     "postback",
            title:    "Share",
            payload:  "MAIN_VIEWMENU"
          }]
        };
        console.log(temp_item);
        messageData.message.attachment.payload.elements.push(temp_item);
      }
    }
  }

  return messageData;
}

function generateVariant(senderID, category, item){
  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: []
        }
      }
    }
  };

  for(var i = 0; i < GlobalMenu.category.length; i++){
    if(GlobalMenu.category[i].payload == category){
      for(var j = 0; j < GlobalMenu.category[i].item.length; j++){
        if(GlobalMenu.category[i].item[j].tag == item){
          for(var k = 0; k < GlobalMenu.category[i].item[j].variant.length; k++){

            if(GlobalMenu.category[i].item[j].variant[k] != ''){
              var title = GlobalMenu.category[i].item[j].variant[k].title + "\u000A"+GlobalMenu.category[i].item[j].variant[k].description;
            }
            else{
              var title = GlobalMenu.category[i].item[j].variant[k].title;
            }

            title = "asd\u000Aqwe";

            var temp_variant = {
              title:      GlobalMenu.category[i].item[j].variant[k].title,
              // image_url:  SERVER_URL + "/assets/rift.png",
              buttons: [{
                type:     "postback",
                title:    "Add to Cart(P"+GlobalMenu.category[i].item[j].variant[k].price+")",
                payload:  "MENU_"+GlobalMenu.category[i].item[j].variant[k].payload+"_ADD"
              }, {
                type:     "postback",
                title:    "Back to meals",
                payload:  "MENU_"+category
              }]
            };
            messageData.message.attachment.payload.elements.push(temp_variant);
          }
        }
      }
    }
  }

  return messageData;
}

function generateQuantity(senderID, item_name, tag, action){
  var text;
  text = "How many items of "+item_name+" do you want?";

  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      text: text,
      quick_replies: []
    }
  };

  for(var i = 1; i <= 10; i++){
    var temp_quantity = {
      content_type:   "text",
      title:          i,
      payload:        tag+"_"+i 
    };
    messageData.message.quick_replies.push(temp_quantity);
  }

  return messageData;
}

function generateNextChoice(senderID){
  var text = "Would you like to continue shopping?";

  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      text: text,
      quick_replies: [{
        content_type:   "text",
        title:          "Yes, continue",
        payload:        "MAIN_VIEWMENU"
      }, {
        content_type:   "text",
        title:          "Place Order",
        payload:        "MAIN_PLACEORDER"
      }, {
        content_type:   "text",
        title:          "Show Cart",
        payload:        "MAIN_SHOWCART"
      }]
    }
  };

  return messageData;
}

function generateCart(senderID, cart){
  console.log("generate Cart");
  if(cart.length == 0){
    var messageData = generateText(senderID, "Cart is Empty.");
  }
  else{
    var messageData = {
      recipient: {
        id: senderID
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: []
          }
        }
      }
    };

    for(var i = 0; i < cart.length; i++){
      var temp_cart = {
        title:      cart[i].OrderTitle,
        subtitle:   "Quantity: "+cart[i].OrderQuantity+"\u000AUnit Price: P"+cart[i].UnitPrice+"\u000ATotal Price: P"+cart[i].TotalPrice,
        image_url:  SERVER_URL+cart[i].OrderImageUrl,
        buttons: [{
          type:     "postback",
          title:    "Place Order",
          payload:  "MAIN_PLACEORDER"
        }, {
          type:     "postback",
          title:    "Change Quantity",
          payload:  "MENU_"+cart[i].OrderTag+"_CHANGE"
        }, {
          type:     "postback",
          title:    "Remove from cart",
          payload:  "MENU_"+cart[i].OrderTag+"_DELETE"
        }]
      };
      messageData.message.attachment.payload.elements.push(temp_cart);
    }
  }
    

  return messageData;
}

function generateReceipt(senderID, cart, address){
  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type:  "receipt",
          recipient_name: "Randy",
          order_number:   senderID,
          currency:       "PHP", 
          payment_method: "Cash of Delivery",
          timestamp:      Math.floor(Date.now()/1000)+57600
        }
      }
    }
  };

  messageData.message.attachment.payload.elements = [];

  var total = 0;
  for(var i = 0; i < cart.length; i++){
    var element = {
      title:      cart[i].OrderTitle,
      subtitle:   "Unit Price: P"+cart[i].UnitPrice,
      quantity:   cart[i].OrderQuantity,
      price:      cart[i].TotalPrice,
      currency:   "PHP",
      image_url:  SERVER_URL + cart[i].OrderImageUrl
    };
    messageData.message.attachment.payload.elements.push(element);
    total += parseFloat(cart[i].TotalPrice);
  }

  messageData.message.attachment.payload.summary = {
    subtotal: total*0.88,
    // total_tax: total*0.12,
    total_cost: total
  };

  messageData.message.attachment.payload.adjustments = [{
    name: "VAT",
    amount: total*0.12
  }];

  return messageData;
}


function generateLocation(senderID){
  console.log('location');
  var text;
  text = "Location";

  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      text: text,
      quick_replies: [{
        "content_type":"location",
      }]
    }
  };

  return messageData;
}

function buildReceipt(senderID, address){
  var data = {
    action:         "get_cart",
    MessengerId:    senderID,
  };
  console.log(data);

  needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', data, GlobalHeader, function(err, resp, body) {
    if(!err){
      console.log(body);
      var cart = JSON.parse(resp.body);

      var buttons = [];
      var position = 0;


      if(cart.cart.length == 0){
        var messageData = generateText(senderID, "Cart is Empty.");
        buttons.push(messageData);
        position++;

        var messageData = generateMenu(senderID);
        buttons.push(messageData);
        position++;
      }
      else {
        var messageData = generateReceipt(senderID, cart.cart, address);
        buttons.push(messageData);
        position++;
      }
      callSendAPI2(buttons, 0);
    }
    else{
      console.log('needle error');
    }
  });
}



function processPostback(payload, senderID, senderName, timeOfPostback){
  timeOfPostback = Math.floor(timeOfPostback/1000);
  console.log("\nPOSTBACK PAYLOAD: "+payload+" SenderID: "+senderID+" Sender Name: "+senderName+"\n");
  var payload_tag = payload.split('_');

  if(payload == 'GET_STARTED'){
    needle.get('https://graph.facebook.com/v2.6/'+senderID+'?access_token='+PAGE_ACCESS_TOKEN, function(error, response) {
      if (!error && response.statusCode == 200){
        var name = response.body.first_name+" "+response.body.last_name;
        console.log(name);

        var data = {
          action:         "add_user",
          MessengerId:    senderID,
          Name:           name
        };
        // console.log(data);

        needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', data, GlobalHeader, function(err, resp, body) {
          if(!err){
            console.log(resp.body);
            var buttons = [];
            var position = 0;

            var messageData = generateText(senderID, "Welcome, "+name);
            buttons.push(messageData);
            position++;

            var messageData = {
              recipient: {
                id: senderID
              },
              message: {
                attachment: {
                  type: "template",
                  payload: {
                    template_type: "generic",
                    elements: [{
                      title: "Delivery Service",
                      subtitle: "Welcome to DeliBot.",
                      // item_url: "https://www.oculus.com/en-us/rift/",               
                      image_url: SERVER_URL + "/assets/rift.png",
                      buttons: [{
                        type: "postback",
                        title: "Delivery Menu",
                        payload: "MAIN_VIEWMENU",
                      }, {
                        type: "postback",
                        title: "Chat with a Human",
                        payload: "MAIN_CHATHUMAN",
                      }, {
                        type: "postback",
                        title: "Book a Table",
                        payload: "MAIN_BOOKTABLE",
                      }],
                    }, {
                      title: "Main Location",
                      subtitle: "Our Address.",
                      // item_url: "https://www.oculus.com/en-us/touch/",               
                      image_url: SERVER_URL + "/assets/touch.png",
                      buttons: [{
                        type: "postback",
                        title: "Get Directions",
                        payload: "ABOUT_LOCATION",
                      }, {
                        type: "postback",
                        title: "Call now",
                        payload: "ABOUT_CALLNOW",
                      }]
                    }]
                  }
                }
              }
            };
            buttons.push(messageData);
            position++;
            callSendAPI2(buttons, 0);
          }
          else{
            console.log('needle error');
          }
        });


      }
        // console.log(response.body);
    });

  }
  else if(payload_tag[0] == 'MAIN'){
    if(payload_tag[1] == 'VIEWMENU'){
      var buttons = [];
      var position = 0;

      var messageData = generateMenu(senderID);
      buttons.push(messageData);
      position++;

      callSendAPI2(buttons, 0);
    }
    else if(payload_tag[1] == 'SHOWCART'){
      var data = {
        action:         "get_cart",
        MessengerId:    senderID,
      };
      console.log(data);

      needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', data, GlobalHeader, function(err, resp, body) {
        if(!err){
          console.log(body);
          var cart = JSON.parse(resp.body);

          var buttons = [];
          var position = 0;


          if(cart.cart.length == 0){
            var messageData = generateText(senderID, "Cart is Empty.");
            buttons.push(messageData);
            position++;

            var messageData = generateMenu(senderID);
            buttons.push(messageData);
            position++;
          }
          else {
            var messageData = generateCart(senderID, cart.cart);
            buttons.push(messageData);
            position++;
          }
          callSendAPI2(buttons, 0);
        }
        else{
          console.log('needle error');
        }
      });
 
    }
    else if(payload_tag[1] == 'PLACEORDER'){

      var data = {
        action:         "check_address",
        MessengerId:    senderID
      };
      console.log(data);

      needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', data, GlobalHeader, function(err, resp, body) {
        if(!err){
          console.log(body);
          var address = JSON.parse(resp.body);
          if(address.address_status == 'NOT SET'){
            var buttons = [];
            var position = 0;

            var messageData = generateLocation(senderID);
            buttons.push(messageData);
            position++;

            callSendAPI2(buttons, 0);
          }
          else{
            buildReceipt(senderID, '');
          }
        }
        else{
          console.log('needle error');
        }
      });



      // var buttons = [];
      // var position = 0;

      // var messageData = generateLocation(senderID);
      // buttons.push(messageData);
      // position++;

      // callSendAPI2(buttons, 0);




      

    }
    else if(payload_tag[1] == 'NEWORDER'){
      console.log('NEWORDER');
      var data = {
        action:         "delete_all_cart",
        MessengerId:    senderID
      };

      needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', data, GlobalHeader, function(err, resp, body) {
        if(!err){
          console.log(resp.body);
          var buttons = [];
          var position = 0;

          var cart = JSON.parse(resp.body);
            
          console.log(cart);

          if(cart.cart === true){
            var messageData = generateText(senderID, "New Transaction Started.");
            buttons.push(messageData);
            position++;

            var messageData = generateMenu(senderID);
            buttons.push(messageData);
            position++;
          }
          else {
            // var messageData = generateCart(senderID, cart.cart);
            // buttons.push(messageData);
            // position++;
            console.log('DELETE FAIL!');
          }
            

          callSendAPI2(buttons, 0);

        }
        else{
          console.log('needle error');
        }
      });
    }
    else if(payload_tag[1] == 'BOOKTABLE'){
      var buttons = [];
      var position = 0;

      var messageData = generateLocation(senderID);
      buttons.push(messageData);
      position++;

      callSendAPI2(buttons, 0);
    }
  }
  else if(payload_tag[0] == 'MENU'){
    if(payload_tag.length == 2){
      var buttons = [];
      var position = 0;

      var messageData = generateText(senderID, "Please choose a meal:");
      buttons.push(messageData);
      position++;

      var messageData = generateItem(senderID, payload_tag[1]);
      buttons.push(messageData);
      position++;

      callSendAPI2(buttons, 0);
    }
    else if(payload_tag.length == 3){
      var buttons = [];
      var position = 0;

      var item_name;
      for(var i = 0; i < GlobalMenu.category.length; i++){
        if(GlobalMenu.category[i].payload == payload_tag[1]){
          for(var j = 0; j < GlobalMenu.category[i].item.length; j++){
            if(GlobalMenu.category[i].item[j].tag == payload_tag[2]){
              item_name = GlobalMenu.category[i].item[j].title;
            }
          }
        }
      }

      var messageData = generateText(senderID, "Choose a variation of "+item_name);
      buttons.push(messageData);
      position++;

      var messageData = generateVariant(senderID, payload_tag[1], payload_tag[2]);
      buttons.push(messageData);
      position++;

      callSendAPI2(buttons, 0);
    }
    else if(payload_tag.length == 5){
      if(payload_tag[4] == 'ADD' || payload_tag[4] == 'CHANGE'){
        console.log('\nADD or CHANGE\n');
        var buttons = [];
        var position = 0;

        var item_name = 'blank';
        for(var i = 0; i < GlobalMenu.category.length; i++){
          if(GlobalMenu.category[i].payload == payload_tag[1]){
            for(var j = 0; j < GlobalMenu.category[i].item.length; j++){
              if(GlobalMenu.category[i].item[j].tag == payload_tag[2]){
                // item_name = lobalMenu.category[i].item[j].title;
                for(var k = 0; k < GlobalMenu.category[i].item[j].variant.length; k++){
                  console.log(GlobalMenu.category[i].item[j].variant[k].tag+" - "+payload_tag[3]);
                  if(GlobalMenu.category[i].item[j].variant[k].tag == payload_tag[3]){
                    item_name = GlobalMenu.category[i].item[j].variant[k].title;
                  }
                }
              }
            }
          }
        }
        console.log(item_name)

        var messageData = generateQuantity(senderID, item_name, payload, payload_tag[4]);
        buttons.push(messageData);
        position++;

        callSendAPI2(buttons, 0);
      }
      else if(payload_tag[4] == "DELETE"){
        var data = {
          action:         "delete_one_cart",
          MessengerId:    senderID,
          OrderTag:       payload_tag[1]+"_"+payload_tag[2]+"_"+payload_tag[3]
        };

        needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', data, GlobalHeader, function(err, resp, body) {
          if(!err){
            console.log(resp.body);
            var buttons = [];
            var position = 0;

            var cart = JSON.parse(resp.body);
              
            console.log(cart);

            var messageData = generateText(senderID, cart.OrderTitle+" has been removed From cart.");
            buttons.push(messageData);
            position++;

            if(cart.cart.length == 0){
              var messageData = generateText(senderID, "Cart is Empty.");
              buttons.push(messageData);
              position++;

              var messageData = generateMenu(senderID);
              buttons.push(messageData);
              position++;
            }
            else {
              var messageData = generateCart(senderID, cart.cart);
              buttons.push(messageData);
              position++;
            }
              

            callSendAPI2(buttons, 0);

          }
          else{
            console.log('needle error');
          }
        });
      }
        
    }
    else if(payload_tag.length == 6){
      var data = {
        MessengerId:    senderID,
        OrderTag:       payload_tag[1]+"_"+payload_tag[2]+"_"+payload_tag[3],
        OrderQuantity:  payload_tag[5]
      };

      if(payload_tag[4] == 'ADD'){
        data.action = "add_to_cart";
      }
      else if(payload_tag[4] == 'CHANGE'){
        data.action = "change_cart";
      }

      console.log(data);

      needle.post('http://gpdigital.crabdance.com/api/v0/delibot.php', data, GlobalHeader, function(err, resp, body) {
        if(!err){
          console.log(resp.body);
          var buttons = [];
          var position = 0;

          var order = JSON.parse(resp.body);
          if(payload_tag[4] == 'ADD'){
            // data.action = "add_to_cart";
            if(order.add.QuantityCurrent == 0){
              var messageData = generateText(senderID, order.add.QuantityAdded+" "+order.add.OrderTitle+" has been added to cart.");
            }
            else {
              var messageData = generateText(senderID, "Updated "+order.add.OrderTitle+" from "+order.add.QuantityCurrent+" to "+(parseInt(order.add.QuantityAdded)+parseInt(order.add.QuantityCurrent))+".");
            }
          }
          else if(payload_tag[4] == 'CHANGE'){
            // data.action = "change_cart";
            var messageData = generateText(senderID, "Updated "+order.change.OrderTitle+" from "+order.change.QuantityCurrent+" to "+(parseInt(order.change.QuantityAdded))+".");
          }          

          
          buttons.push(messageData);
          position++;

          // var messageData = generateMenu(senderID);
          var messageData = generateNextChoice(senderID);
          buttons.push(messageData);
          position++;

          callSendAPI2(buttons, 0);
        }
        else{
          console.log('needle error');
        }
      });
        
    }
    else{
      console.log('\nOTHERS\n');
    }
  }
  else{
    sendTextMessage(senderID, "Postback: "+payload+" called");
  }
}



/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var senderName = event.sender.name;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);
  console.log(event);

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful

  processPostback(payload, senderID, senderName, timeOfPostback);

  // sendTextMessage(senderID, "Postback called");
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 */
function receivedAccountLink(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var status = event.account_linking.status;
  var authCode = event.account_linking.authorization_code;

  console.log("Received account link event with for user %d with status %s " +
    "and auth code %s ", senderID, status, authCode);
}

/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/rift.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/instagram_logo.gif"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send audio using the Send API.
 *
 */
function sendAudioMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "audio",
        payload: {
          url: SERVER_URL + "/assets/sample.mp3"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 *
 */
function sendVideoMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "video",
        payload: {
          url: SERVER_URL + "/assets/allofus480.mov"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a file using the Send API.
 *
 */
function sendFileMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "file",
        payload: {
          url: SERVER_URL + "/assets/test.txt"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons:[{
            type: "web_url",
            url: "https://www.oculus.com/en-us/rift/",
            title: "Open Web URL"
          }, {
            type: "postback",
            title: "Trigger Postback",
            payload: "DEVELOPER_DEFINED_PAYLOAD"
          }, {
            type: "phone_number",
            title: "Call Phone Number",
            payload: "+16505551234"
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: SERVER_URL + "/assets/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: SERVER_URL + "/assets/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random()*1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",        
          timestamp: "1428444852", 
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: SERVER_URL + "/assets/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: SERVER_URL + "/assets/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "What's your favorite movie genre?",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Action",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
        },
        {
          "content_type":"text",
          "title":"Comedy",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY"
        },
        {
          "content_type":"text",
          "title":"Drama",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_DRAMA"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {
  console.log("Sending a read receipt to mark message as seen");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {
  console.log("Turning typing indicator off");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_off"
  };

  callSendAPI(messageData);
}

/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Welcome. Link your account.",
          buttons:[{
            type: "account_link",
            url: SERVER_URL + "/authorize"
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });  
}


function callSendAPI2(messageData, position) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData[position]

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if(position < messageData.length - 1){
        callSendAPI2(messageData, position+1);
      }


      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });  
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;

