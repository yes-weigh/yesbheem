const axios = require('axios');

const clientId = '1000.HZFLLMJSBILI6M6NQ5QMVSKE0W9Z1Y';
const clientSecret = '9eee125bf23f319fe0689176114c8dbd0ec2b975cc';
const code = '1000.f5665c65e7f57a767addaef9dc8a506b.a2975701f9c8d2ec2941da32a24b70e3';

(async () => {
    try {
        const res = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
            params: {
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: 'http://localhost/callback',
                grant_type: 'authorization_code'
            }
        });
        console.log('SUCCESS:');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('ERROR:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
    }
})();
