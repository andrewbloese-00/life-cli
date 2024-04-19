import { createClient  } from '@libsql/client'
import { config } from 'dotenv'
import { panic } from '../utils/panic.js';
config();


//determines which client to use 'turso' or 'local'
function useClientConfig(){
    if(process.env.USE_TURSO){ //turso connection
        if(!process.env.TURSO_URL || !process.env.TURSO_AUTH_TOKEN) {
            panic("ERR: Must provide TURSO_URL and TURSO_AUTH_TOKEN to connect to turso db!")
        }
        return {
            url: process.env.TURSO_URL,
            authToken: process.env.TURSO_AUTH_TOKEN
        }
    } else { //local connection
        if(!process.env.LOCAL_DB) panic("ERR: Must provide a LOCAL_DB path to connect to local sqlite db!");
        return { 
            url: `file:${process.env.LOCAL_DB}`
        }
    }
}
const clientConfig = useClientConfig()
export const db = createClient(clientConfig);



