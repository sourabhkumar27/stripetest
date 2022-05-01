import * as mongoDB from "mongodb";
import env from "dotenv";
import Data from "./models/data"
// Replace if using a different env file or config.
env.config({ path: "./.env" });

let datasCollection: mongoDB.Collection;

export async function connectToDatabase () {

   const client: mongoDB.MongoClient = new mongoDB.MongoClient(process.env.DB_CONN_STRING);
           
   await client.connect();
       
   const db: mongoDB.Db = client.db(process.env.DB_NAME);
  
   datasCollection = db.collection(process.env.DATA_COLLECTION_NAME);
}

export async function saveToDatabase(data: Data): Promise<Boolean> {
  
  try {
    const result = await datasCollection.insertOne(data);

    if (result) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
      console.error(error);
      return false;
  }
}
