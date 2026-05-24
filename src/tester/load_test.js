const TOTAL_REQUESTS = 4;

const URL = 'http://localhost:3001/';

const sendRequest = async (id) => {

    try{
        console.log(`Request ${id} started`);
        const response = await fetch(URL);
        const data = await response.json();

        if(response.ok) console.log(`✅ Request ${id} success`, data);
        else console.log(`❌ Request ${id} failed`, response.status, data);
    }catch (err){
        console.log(`❌ Request ${id} error`, err.message);
    }
};

const runLoadTest = async () => {

    const promises = [];
    for(let i=1; i<=TOTAL_REQUESTS; i++) promises.push(sendRequest(i));
    await Promise.all(promises);

    console.log("\nLoad test completed");
};

runLoadTest();