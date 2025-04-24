import { connect } from "mongoose";
const MONGO_URL = process.env.MONGO_URL;

async function connectDatabase() {
    try {
        await connect(MONGO_URL);
        console.log("Database connected✅");
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

export default connectDatabase;
