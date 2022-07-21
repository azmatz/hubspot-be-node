const express = require('express')
const app = express()
const port = 5500
const axios = require('axios')
const queryString = require('query-string');
const FormData = require('form-data')
const request = require('request');
const cors = require('cors');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
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
        "link": `https://app.hubspot.com/oauth/authorize?client_id=5cd0947b-1d83-4ec0-a125-11d942360929&https://app.hubspot.com/oauth/authorize?client_id=5cd0947b-1d83-4ec0-a125-11d942360929&redirect_uri=https://a410-38-70-168-4.ngrok.io/oauth-callback&scope=contacts%20crm.lists.read%20crm.objects.contacts.read%20crm.objects.contacts.write%20crm.objects.companies.write%20crm.schemas.contacts.read%20crm.lists.write%20crm.objects.companies.read%20crm.objects.deals.read%20crm.objects.deals.write%20crm.schemas.companies.read%20crm.schemas.companies.write%20crm.schemas.contacts.write%20crm.schemas.deals.read%20crm.schemas.deals.write%20crm.objects.owners.read`,
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
      client_id: '5cd0947b-1d83-4ec0-a125-11d942360929',
      client_secret: 'a7f06796-590f-4183-9ff6-1bdd76040071',
      redirect_uri: 'https://a410-38-70-168-4.ngrok.io/oauth-callback',
      code: req.query.code
    }

    request.post('https://api.hubapi.com/oauth/v1/token', { form: formData }, async (err, data) => {  
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
app.post('/hubspot-contacts/:access_token', async (req, res) => {
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
          console.log("API-------------------------------", e.body.category)
          res.status(201).send({ url: `https://app.hubspot.com/oauth/authorize?client_id=5cd0947b-1d83-4ec0-a125-11d942360929&https://app.hubspot.com/oauth/authorize?client_id=5cd0947b-1d83-4ec0-a125-11d942360929&redirect_uri=https://a410-38-70-168-4.ngrok.io/oauth-callback&scope=contacts%20crm.lists.read%20crm.objects.contacts.read%20crm.objects.contacts.write%20crm.objects.companies.write%20crm.schemas.contacts.read%20crm.lists.write%20crm.objects.companies.read%20crm.objects.deals.read%20crm.objects.deals.write%20crm.schemas.companies.read%20crm.schemas.companies.write%20crm.schemas.contacts.write%20crm.schemas.deals.read%20crm.schemas.deals.write%20crm.objects.owners.read` })
        }
    }
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})