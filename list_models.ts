import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI();
ai.models.list().then(response => {
    for (const page of response) {
        for (const model of page) {
            console.log(model.name);
        }
    }
}).catch(console.error);
