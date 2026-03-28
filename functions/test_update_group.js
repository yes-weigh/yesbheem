const axios = require('axios');
const fs = require('fs');

const clientId = '1000.HZFLLMJSBILI6M6NQ5QMVSKE0W9Z1Y';
const clientSecret = '9eee125bf23f319fe0689176114c8dbd0ec2b975cc';
const refreshToken = '1000.c1567dd50ec78df9166f106ddb9530dc.aaeffb4e5916a9289d5f4b52989ee995';
const orgId = '60001225303';
const ZOHO_API_BASE = 'https://www.zohoapis.in';

async function test() {
    try {
        const tokenRes = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
            params: { refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }
        });
        const accessToken = tokenRes.data.access_token;

        const groupsRes = await axios.get(`${ZOHO_API_BASE}/inventory/v1/itemgroups`, {
            params: { organization_id: orgId },
            headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        
        console.log("Groups:", groupsRes.data.itemgroups.slice(0, 3).map(g => ({id: g.group_id, name: g.group_name})));
        
        const itemsRes = await axios.get(`${ZOHO_API_BASE}/inventory/v1/items`, {
            params: { organization_id: orgId, name_startswith: '0.1MG Machine Base' },
            headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const item = itemsRes.data.items[0];
        console.log("Item:", item.item_id, item.name, "Current Group:", item.group_name);
        
        const updateRes = await axios.put(`${ZOHO_API_BASE}/inventory/v1/items/${item.item_id}`, {
            item_group_id: groupsRes.data.itemgroups[0].group_id
        }, {
            params: { organization_id: orgId },
            headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        console.log("Update Success:", updateRes.data.code, updateRes.data.message);
    } catch (e) {
        console.error("Error:", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
    }
}
test();
