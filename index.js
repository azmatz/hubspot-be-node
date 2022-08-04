const express = require('express')
require('dotenv').config()
const app = express()
const port = 5500
const queryString = require('query-string');
const request = require('request');
const cors = require('cors');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const hubspot = require('@hubspot/api-client')

app.use(express.json());
app.use(cors());

mongoose.connect('mongodb://localhost:27017/hubspot');

const userRecord = new Schema({
  email: String,
  contactId: String,
  token: String
});

const Record = mongoose.model('Record', userRecord);

// HubSpot default request
app.get('/', async (req, res) => {
  const parsed = queryString.parse(req.url)
  const record = await new Record({ email: parsed.userEmail, contactId: parsed.hs_object_id })
  record.save()
  res.send({
    "results": [{
        "objectId": 245,
        "title": "Send Gift via Giftcenter",
        "link": process.env.DEFAULT_LINK,
        "created": "2019-09-15",
        "description": "Giftagram. Making it easy to be thoughtful.",
      },
    ],
  })
  res.end()
})

// HubSpot callback
// Get access token from special code
app.get('/oauth-callback', async (req, res) => {
  if (req.query) {
    const formData = {
      grant_type: 'authorization_code',
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      code: req.query.code
    }

    request.post(process.env.HS_GET_TOKEN, { form: formData }, async (err, data) => {  
      const token = JSON.parse(data.body)
      const hubspotClient = new hubspot.Client({});
    
      try {
        const apiResponse = await hubspotClient.oauth.accessTokensApi.getAccessToken(token.access_token);
        const record = await Record.findOneAndUpdate({ email: apiResponse.user, token: apiResponse.token })
        console.log(record);
        await record.save()
        let giftcenter_url

        // Switch to correct GiftCenter
        if (apiResponse.user.includes('giftagram')) giftcenter_url = 'http://localhost:3000' 

        // Redirect to Product Directory
        res.redirect(`${giftcenter_url}/product-directory?token=${token.access_token}&userEmail=${apiResponse.user}`);
      } catch (e) {
        e.message === 'HTTP request failed'
          ? console.error(JSON.stringify(e.response, null, 2))
          : console.error(e)
      }
    })
  }
});

// Get single HubSpot contact
app.post('/hubspot-contact/:access_token', async (req, res) => {
  console.log(req.body)
  if (req.params.access_token && req.body.userEmail) {
    const contactId = await Record.find({ email: req.body.userEmail })
    console.log("ContactID", contactId[contactId.length - 1] )
    const hubspotClient = new hubspot.Client({"accessToken":req.params.access_token});
    const properties = ['firstname', 'lastname', 'phone', 'email', 'address', 'state', 'zip', 'country', 'city'];
    const propertiesWithHistory = undefined;
    const associations = undefined;
    const archived = false;
    try {
      const apiResponse = await hubspotClient.crm.contacts.basicApi.getById(contactId[contactId.length - 1].contactId, properties, propertiesWithHistory, associations, archived);
      console.log("Contacts response", JSON.stringify(apiResponse, null, 2));
      res.send(apiResponse)
    } catch (e) {
      e.message === 'HTTP request failed'
        ? console.error(JSON.stringify(e.response, null, 2))
        : console.error(e)
    }
  }
});

// Search HubSpot contacts
app.post('/search-hubspot-contacts/:access_token', async (req, res) => {
  console.log("REQ", req.body)
  console.log("ACCCESS", req.params.access_token)
  if (req.params.access_token) {
   
    const hubspotClient = new hubspot.Client({"accessToken":req.params.access_token});

    const filter = { propertyName: 'firstname', operator: 'GTE', value: req.body.query }
    const filterGroup = { filters: [filter] }
    const properties = ['firstname', 'lastname', 'phone', 'email', 'address', 'state', 'zip', 'country', 'city'];
    
    const publicObjectSearchRequest = {
        filterGroups: [filterGroup],
        properties
      };
    
    try {
      const apiResponse = await hubspotClient.crm.contacts.searchApi.doSearch(publicObjectSearchRequest);
      console.log(JSON.stringify(apiResponse, null, 2));
      res.status(200).send(apiResponse)
    } catch (e) {
      e.message === 'HTTP request failed'
        ? console.error(e.response, null, 2)
        : console.error(e)
        if (e.body.category == 'EXPIRED_AUTHENTICATION') {
          res.status(201).send({ url: process.env.DEFAULT_LINK })
        }
    }
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})