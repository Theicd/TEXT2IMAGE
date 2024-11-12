// dbConnection.js
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://dror201031:your_password_here@cluster01.lqzjf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster01";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectToDatabase() {
  try {
    if (!client.isConnected()) {
      await client.connect();
      console.log("Successfully connected to MongoDB!");
    }
    return client.db("your_database_name");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    throw error;
  }
}

module.exports = connectToDatabase;
