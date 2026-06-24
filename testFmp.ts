import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.FMP_API_KEY;

async function test() {
    try {
        console.log('Testing /stable/profile?symbol=SPCX');
        const profile = await axios.get(`https://financialmodelingprep.com/stable/profile?symbol=SPCX&apikey=${API_KEY}`);
        console.log('Pełny profil:', JSON.stringify(profile.data[0], null, 2));
    } catch (e: any) {
        console.error('Error on profile:', e.response?.status, e.response?.data || e.message);
    }
}
test();
