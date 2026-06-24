import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.FMP_API_KEY;

async function test() {
    try {
        console.log('Testing /stable/profile?symbol=AAPL');
        const profile = await axios.get(`https://financialmodelingprep.com/stable/profile?symbol=AAPL&apikey=${API_KEY}`);
        console.log('Profile Keys:', Object.keys(profile.data[0]));
        console.log('Profile has ipoDate:', profile.data[0]?.ipoDate);
    } catch (e: any) {
        console.error('Error on profile:', e.response?.status, e.response?.data || e.message);
    }
}
test();
