import { Types } from "mongoose";

const validateObjectId = (id) => Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id;

export default validateObjectId;
