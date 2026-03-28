const axios = require('axios');
const fs = require('fs');

const clientId = '1000.QF6JPR5IFOYIHPUUF6Q5ONP90H7KBT';
const clientSecret = 'bd56478cfad01448a829c324fe1b6245dccf9eb4a7';
const refreshToken = '1000.12f61456446269e734cc03521c69bf26.dda7598b7c9d08aea6bbbda51eff387f';
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
