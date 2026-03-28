const axios = require('axios');

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
        
        console.log("Token obtained", accessToken);
        
        // Let's try to parse the 85 bytes 
        // group_id is 17 chars: "99381000018459651"
        // organization_id is 11 chars: "60001225303"
        
        const itemId = '99381000004434442';
        const groupId = '99381000018459651';
        
        const params = new URLSearchParams();
        params.append('organization_id', orgId);
        params.append('JSONString', JSON.stringify({ group_id: groupId }));
        
        const res1 = await axios.put(`${ZOHO_API_BASE}/inventory/v1/items/move/${itemId}`, params.toString(), {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            }
        });
        
        console.log("Success with JSONString:", res1.data);
    } catch (e) {
        console.error("Error with JSONString:", e.response ? e.response.data : e.message);
    }
}

test();
