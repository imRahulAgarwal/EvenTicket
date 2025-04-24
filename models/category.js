import { Schema, model } from "mongoose";

const categorySchema = new Schema(
    {
        name: String,
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const Category = model("category", categorySchema, "category");

export default Category;
